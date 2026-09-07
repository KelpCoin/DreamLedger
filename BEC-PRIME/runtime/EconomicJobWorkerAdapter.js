'use strict';

const workerPool = require('./worker-pool');

const DEFAULT_BRIDGE_URL = process.env.BEC_AGENT_BRIDGE_URL || process.env.AGENT_BRIDGE_URL || 'http://127.0.0.1:3000';
const DEFAULT_BRIDGE_PATH = '/api/agent-bridge/jobs/next';
const JOB_KIND_MAP = new Map([
  ['analysis', 'analysis'],
  ['code_change', 'code_change'],
  ['gauntlet', 'gauntlet'],
  ['compile', 'compile'],
  ['test', 'test'],
  ['lm_refinement', 'lm_refinement']
]);

function requiredString(value, field) {
  const text = String(value == null ? '' : value).trim();
  if (!text) throw new Error(`${field} is required`);
  return text;
}

function normalizeKind(jobType) {
  const raw = String(jobType || '').trim().toLowerCase();
  return JOB_KIND_MAP.get(raw) || 'analysis';
}

function toWorkerJob(jobEnvelope) {
  if (!jobEnvelope || typeof jobEnvelope !== 'object') throw new Error('job envelope is required');

  const objective = requiredString(jobEnvelope.objective, 'objective');
  const jobId = requiredString(jobEnvelope.job_id, 'job_id');
  const silo = String(jobEnvelope.silo || 'BEC-ECONOMIC').trim() || 'BEC-ECONOMIC';
  const offerIds = Array.isArray(jobEnvelope.offer_ids) ? jobEnvelope.offer_ids.filter(Boolean).map(String) : [];
  const evidenceRequirements = jobEnvelope.required_evidence || {};
  const effects = Array.isArray(jobEnvelope.effects) ? jobEnvelope.effects : [];

  return {
    job_id: `bridge_${jobId}`,
    kind: normalizeKind(jobEnvelope.job_type),
    silo,
    task: objective,
    inputs: {
      bridge_job_id: jobId,
      source: jobEnvelope.source || 'agent-bridge',
      candidate_id: jobEnvelope.candidate_id || null,
      offer_ids: offerIds,
      evidence_requirements: evidenceRequirements,
      existing_evidence: jobEnvelope.existing_evidence || null,
      approval_gate: jobEnvelope.approval_gate || null,
      next_permitted_action: jobEnvelope.next_permitted_action || null
    },
    effects,
    approval_required: true,
    public_action_allowed: false,
    worker_preference: 'auto'
  };
}

async function fetchNextJob(options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new Error('fetch is not available');
  const baseUrl = String(options.baseUrl || DEFAULT_BRIDGE_URL).replace(/\/$/, '');
  const endpoint = `${baseUrl}${options.path || DEFAULT_BRIDGE_PATH}`;
  const token = String(options.token || process.env.DREAMLEDGER_AGENT_BRIDGE_TOKEN || '');
  if (!token) throw new Error('DREAMLEDGER_AGENT_BRIDGE_TOKEN is required');

  const response = await fetchImpl(endpoint, {
    method: 'GET',
    headers: { 'x-dreamledger-agent-token': token, Accept: 'application/json' }
  });
  const text = await response.text();
  let body;
  try { body = JSON.parse(text || '{}'); } catch { throw new Error('Agent bridge returned invalid JSON'); }
  if (!response.ok) throw new Error(body.error || `Agent bridge request failed (${response.status})`);
  if (body.schema_version !== 'BECK-ECONOMIC-JOB-1.0') throw new Error('Unexpected agent bridge job schema');
  return body.job || null;
}

async function adaptJob(jobEnvelope, options = {}) {
  const pool = options.workerPool || workerPool;
  if (!pool || typeof pool.createJob !== 'function' || typeof pool.execute !== 'function') {
    throw new Error('worker pool must expose createJob() and execute()');
  }

  const workerJob = toWorkerJob(jobEnvelope);
  const created = await pool.createJob(workerJob);
  const createdJobId = typeof created === 'string' ? created : created && created.job_id;
  if (!createdJobId) throw new Error('worker pool did not return a job id');

  const execution = await pool.execute(createdJobId);
  const result = execution && execution.result ? execution.result : null;
  const proof = execution && execution.proof ? execution.proof : null;

  return {
    schema_version: 'BECK-ECONOMIC-WORKER-RESULT-1.0',
    source_job_id: jobEnvelope.job_id,
    worker_job_id: createdJobId,
    status: execution && execution.job ? execution.job.status : (result && result.status) || 'UNKNOWN',
    artifacts: result && result.output ? result.output : null,
    proof_ref: proof ? (proof.proof_hash || proof.proof_id || null) : null,
    evidence_claims: result && result.evidence_claims ? result.evidence_claims : {
      payment_claim: false,
      sale_claim: false,
      fulfillment_claim: false
    },
    irreversible_effects_triggered: false
  };
}

async function runNext(options = {}) {
  const job = await fetchNextJob(options);
  if (!job) return { status: 'IDLE' };
  return adaptJob(job, options);
}

module.exports = { fetchNextJob, toWorkerJob, adaptJob, runNext };

if (require.main === module) {
  runNext().then(result => console.log(JSON.stringify(result, null, 2))).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
