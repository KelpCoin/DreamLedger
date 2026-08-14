'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const QUEUE_DIR = path.resolve(process.env.BEC_JOB_QUEUE_DIR || path.join(ROOT, 'data', 'jobs'));
const JOBS_DIR = path.join(QUEUE_DIR, 'jobs');
const RESULTS_DIR = path.join(QUEUE_DIR, 'results');
const PROOF_DIR = path.resolve(process.env.BEC_PROOF_DIR || path.join(ROOT, 'data', 'proofs'));
const DEFAULT_LM_URL = process.env.BEC_LM_URL || 'http://127.0.0.1:1234/v1/chat/completions';
const DEFAULT_LM_MODEL = process.env.BEC_LM_MODEL || 'local-model';
const GPU_LM_URL = process.env.BEC_GPU_LM_URL || '';
const GPU_LM_MODEL = process.env.BEC_GPU_LM_MODEL || '';
const CLOUD_LM_URL = process.env.BEC_CLOUD_LM_URL || process.env.BEC_REMOTE_LM_URL || '';
const CLOUD_LM_MODEL = process.env.BEC_CLOUD_LM_MODEL || process.env.BEC_REMOTE_LM_MODEL || '';
const ALLOWED_KINDS = new Set(['analysis', 'code_change', 'gauntlet', 'compile', 'test', 'lm_refinement']);
const FORBIDDEN_EFFECTS = new Set(['money', 'checkout', 'public_post', 'production_mutation']);

for (const dir of [QUEUE_DIR, JOBS_DIR, RESULTS_DIR, PROOF_DIR]) fs.mkdirSync(dir, { recursive: true });

function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
}

function hash(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : canonical(value), 'utf8').digest('hex');
}

function id(prefix) {
  return `${prefix}_${new Date().toISOString().replace(/[-:.TZ]/g, '')}_${crypto.randomBytes(4).toString('hex')}`;
}

function jobPath(jobId) { return path.join(JOBS_DIR, `${jobId}.json`); }
function resultPath(jobId) { return path.join(RESULTS_DIR, `${jobId}.json`); }

function loadJob(jobId) {
  const file = jobPath(jobId);
  if (!fs.existsSync(file)) throw new Error(`Unknown job: ${jobId}`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function validateJob(input) {
  if (!input || typeof input !== 'object') throw new Error('Job must be an object');
  if (!ALLOWED_KINDS.has(input.kind)) throw new Error(`Unsupported job kind: ${input.kind}`);
  if (!input.silo || typeof input.silo !== 'string') throw new Error('silo is required');
  if (!input.task || typeof input.task !== 'string') throw new Error('task is required');
  const effects = Array.isArray(input.effects) ? input.effects : [];
  const blocked = effects.filter(x => FORBIDDEN_EFFECTS.has(x));
  if (blocked.length) throw new Error(`Irreversible effects require a separate human approval path: ${blocked.join(',')}`);
  return { effects };
}

function createJob(input) {
  validateJob(input);
  const jobId = input.job_id || id('job');
  const job = {
    schema_version: 'BEC-WORKER-JOB-1.0',
    job_id: jobId,
    created_at: new Date().toISOString(),
    status: 'QUEUED',
    silo: input.silo,
    kind: input.kind,
    task: input.task,
    inputs: input.inputs || {},
    effects: input.effects || [],
    worker_preference: input.worker_preference || 'auto',
    approval_required: true,
    public_action_allowed: false,
    previous_result_hash: null
  };
  job.input_hash = `sha256:${hash(job)}`;
  fs.writeFileSync(jobPath(jobId), JSON.stringify(job, null, 2) + '\n', { flag: 'wx' });
  return job;
}

function listJobs() {
  return fs.readdirSync(JOBS_DIR).filter(x => x.endsWith('.json')).map(x => JSON.parse(fs.readFileSync(path.join(JOBS_DIR, x), 'utf8'))).sort((a, b) => a.created_at.localeCompare(b.created_at));
}

function endpointHeaders(apiKey) {
  return apiKey ? { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` } : { 'Content-Type': 'application/json' };
}

async function runCompatibleModel(job, config) {
  const payload = {
    model: config.model,
    messages: [
      { role: 'system', content: job.inputs.system || 'You are an untrusted worker in BrownEye Cortex. Propose work, do not claim evidence, and do not perform irreversible actions.' },
      { role: 'user', content: job.task + '\n\nINPUTS:\n' + JSON.stringify(job.inputs) }
    ],
    temperature: Number(job.inputs.temperature ?? 0.2)
  };
  const response = await fetch(config.url, { method: 'POST', headers: endpointHeaders(config.apiKey), body: JSON.stringify(payload) });
  const text = await response.text();
  if (!response.ok) throw new Error(`${config.name} ${response.status}: ${text.slice(0, 2000)}`);
  const data = JSON.parse(text);
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new Error(`${config.name} response did not contain choices[0].message.content`);
  return { worker: config.name, model: config.model, endpoint: config.url, content };
}

async function runLmStudio(job) {
  return runCompatibleModel(job, { name: 'local-lmstudio', url: job.inputs.url || DEFAULT_LM_URL, model: job.inputs.model || DEFAULT_LM_MODEL, apiKey: '' });
}

async function runGpuModel(job) {
  const url = job.inputs.gpu_url || GPU_LM_URL;
  const model = job.inputs.gpu_model || GPU_LM_MODEL;
  if (!url || !model) throw new Error('GPU worker is not configured: set BEC_GPU_LM_URL and BEC_GPU_LM_MODEL');
  return runCompatibleModel(job, { name: 'gpu', url, model, apiKey: process.env.BEC_GPU_LM_API_KEY || '' });
}

async function runCloudModel(job) {
  const url = job.inputs.cloud_url || CLOUD_LM_URL;
  const model = job.inputs.cloud_model || CLOUD_LM_MODEL;
  if (!url || !model) throw new Error('Cloud worker is not configured: set BEC_CLOUD_LM_URL and BEC_CLOUD_LM_MODEL');
  return runCompatibleModel(job, { name: 'cloud', url, model, apiKey: process.env.BEC_CLOUD_LM_API_KEY || process.env.BEC_REMOTE_LM_API_KEY || '' });
}

async function execute(job) {
  const started = new Date().toISOString();
  let output;
  const preference = job.worker_preference;

  if (preference === 'local-lmstudio') output = await runLmStudio(job);
  else if (preference === 'gpu') output = await runGpuModel(job);
  else if (preference === 'cloud' || preference === 'remote-cloud') output = await runCloudModel(job);
  else if (preference === 'auto') {
    const attempts = [
      ['local-lmstudio', runLmStudio],
      ['gpu', runGpuModel],
      ['cloud', runCloudModel]
    ];
    let lastError = null;
    for (const [name, runner] of attempts) {
      try { output = await runner(job); break; } catch (error) { lastError = `${name}: ${error.message}`; }
    }
    if (!output) output = { worker: 'deterministic', message: 'No model endpoint available; artifact is a deterministic proposal only', task: job.task, fallback_reason: lastError };
  } else throw new Error(`Unsupported worker preference: ${preference}`);

  const result = {
    schema_version: 'BEC-WORKER-RESULT-1.0',
    job_id: job.job_id,
    started_at: started,
    completed_at: new Date().toISOString(),
    status: 'ARTIFACT_READY',
    worker: output.worker,
    output,
    evidence_claims: { payment_claim: false, sale_claim: false, fulfillment_claim: false },
    public_action_allowed: false
  };
  result.output_hash = `sha256:${hash(result.output)}`;
  result.result_hash = `sha256:${hash(result)}`;
  fs.writeFileSync(resultPath(job.job_id), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  const proof = {
    schema_version: 'BEC-WORKER-PROOF-1.0',
    proof_id: id('proof'),
    job_id: job.job_id,
    silo: job.silo,
    status: 'PASS',
    worker: output.worker,
    input_hash: job.input_hash,
    result_hash: result.result_hash,
    claims: result.evidence_claims,
    approval_required: true,
    public_action_allowed: false,
    created_at: new Date().toISOString()
  };
  proof.proof_hash = `sha256:${hash(proof)}`;
  fs.writeFileSync(path.join(PROOF_DIR, `${job.job_id}.json`), JSON.stringify(proof, null, 2) + '\n', { flag: 'wx' });
  const updated = { ...job, status: 'ARTIFACT_READY', result_hash: result.result_hash, proof_hash: proof.proof_hash, completed_at: result.completed_at };
  fs.writeFileSync(jobPath(job.job_id), JSON.stringify(updated, null, 2) + '\n');
  return { job: updated, result, proof };
}

async function runNext() {
  const job = listJobs().find(x => x.status === 'QUEUED');
  if (!job) return { status: 'IDLE' };
  try { return await execute(job); } catch (error) {
    const failed = { ...job, status: 'FAILED', failed_at: new Date().toISOString(), error: error.message };
    fs.writeFileSync(jobPath(job.job_id), JSON.stringify(failed, null, 2) + '\n');
    return { job: failed, status: 'FAILED', error: error.message };
  }
}

module.exports = { canonical, hash, createJob, listJobs, loadJob, runNext, execute };

if (require.main === module) {
  const [command, ...rest] = process.argv.slice(2);
  (async () => {
    if (command === 'enqueue') {
      const file = rest[0];
      const input = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
      console.log(JSON.stringify(createJob(input), null, 2));
      return;
    }
    if (command === 'run-once') {
      console.log(JSON.stringify(await runNext(), null, 2));
      return;
    }
    if (command === 'list') {
      console.log(JSON.stringify(listJobs(), null, 2));
      return;
    }
    throw new Error('Usage: node runtime/worker-pool.js enqueue <job.json> | run-once | list');
  })().catch(error => { console.error(error.message); process.exitCode = 1; });
}
