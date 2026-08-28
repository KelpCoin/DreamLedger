'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const { createJob, listJobs, runNext } = require('./worker-pool');

const ROOT = path.join(__dirname, '..');
const DATA = path.resolve(process.env.BEC_COMMANDER_DATA_ROOT || 'D:\\BrownEyeCortex\\Commander');
const LOG = path.join(DATA, 'logs', 'commander.jsonl');
const PROOF = path.join(DATA, 'proofs', 'COMMANDER-LATEST.json');

const LM_URL = (process.env.BEC_LM_URL || 'http://127.0.0.1:1235/v1/chat/completions').replace(/\/$/, '');
const LM_MODEL = process.env.BEC_LM_MODEL || 'openai/gpt-oss-20b';
const POLL_SECONDS = Math.max(5, Number(process.env.BEC_COMMANDER_POLL_SECONDS || 15));

for (const dir of [path.dirname(LOG), path.dirname(PROOF)]) {
  fs.mkdirSync(dir, { recursive: true });
}

function log(event, data) {
  fs.appendFileSync(LOG, JSON.stringify({
    at: new Date().toISOString(),
    event,
    ...data
  }) + '\n', 'utf8');
}

function writeProof(payload) {
  fs.writeFileSync(PROOF, JSON.stringify(payload, null, 2) + '\n', 'utf8');
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const req = http.request(target, { method: 'GET' }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const data = JSON.parse(body || '{}');
          if (res.statusCode >= 400) {
            reject(new Error('HTTP ' + res.statusCode));
            return;
          }
          resolve(data);
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function hasQueuedWork() {
  return listJobs().some(job => job.status === 'QUEUED');
}

function hasRecentCommanderJob() {
  const cutoff = Date.now() - (30 * 60 * 1000);
  return listJobs().some(job =>
    job.kind === 'analysis' &&
    job.task &&
    job.task.indexOf('BEC COMMANDER ECONOMIC SCAN') >= 0 &&
    new Date(job.created_at).getTime() >= cutoff
  );
}

function createScanJob() {
  return createJob({
    silo: 'dreamledger',
    kind: 'analysis',
    task:
      'BEC COMMANDER ECONOMIC SCAN\n' +
      'Inspect the verified DreamLedger commercial state supplied below. ' +
      'Identify exactly one highest-value next 20-minute atom. ' +
      'Do not execute it. Do not claim a sale, customer, payment, inventory fact, or external action that is not present in the supplied data. ' +
      'Return a concise proposed next action and the evidence supporting it.',
    inputs: {
      model: LM_MODEL,
      url: LM_URL,
      temperature: 0.1,
      system:
        'You are BEC Commander, an economic planning worker. ' +
        'Your output is untrusted analysis. Propose only. ' +
        'Never claim evidence you were not given. Never perform irreversible actions. ' +
        'Prefer real revenue evidence over infrastructure work.',
      runtime: {
        generated_at: new Date().toISOString(),
        source: 'local-commander'
      }
    },
    effects: [],
    worker_preference: 'local-lmstudio'
  });
}

async function lmHealth() {
  try {
    const base = LM_URL.split('/v1/')[0];
    const response = await getJson(base + '/v1/models');
    const ids = Array.isArray(response.data) ? response.data.map(x => x.id) : [];
    return {
      reachable: true,
      models: ids,
      selected_model: LM_MODEL,
      selected_model_present: ids.indexOf(LM_MODEL) >= 0
    };
  } catch (err) {
    return {
      reachable: false,
      models: [],
      selected_model: LM_MODEL,
      selected_model_present: false,
      error: err.message
    };
  }
}

async function cycle() {
  const started = new Date().toISOString();
  const health = await lmHealth();
  let action = 'QUEUE_IDLE';

  if (hasQueuedWork()) {
    const result = await runNext();
    action = result && result.status === 'IDLE' ? 'QUEUE_IDLE' : 'JOB_DISPATCHED';
    log('worker_cycle', { result_status: result && result.status, job_id: result && result.job && result.job.job_id });
  } else if (health.reachable && !hasRecentCommanderJob()) {
    const job = createScanJob();
    action = 'COMMANDER_SCAN_QUEUED';
    log('scan_queued', { job_id: job.job_id, model: LM_MODEL, endpoint: LM_URL });
  }

  const jobs = listJobs();

  const proof = {
    schema_version: 'BEC-COMMANDER-RUNTIME-1.0',
    status: health.reachable ? 'PASS' : 'DEGRADED',
    started_at: started,
    completed_at: new Date().toISOString(),
    orchestrator: 'BEC-LocalCommander',
    lm_studio: health.reachable ? 'REACHABLE' : 'UNREACHABLE',
    lm_endpoint: LM_URL,
    model_selected: LM_MODEL,
    model_present: health.selected_model_present,
    action,
    queued_jobs: jobs.filter(x => x.status === 'QUEUED').length,
    active_jobs: jobs.filter(x => x.status === 'RUNNING').length,
    completed_jobs: jobs.filter(x => x.status === 'ARTIFACT_READY').length,
    failed_jobs: jobs.filter(x => x.status === 'FAILED').length,
    public_action: false,
    approval_boundary: 'REQUIRED',
    irreversible_actions_enabled: false
  };

  writeProof(proof);
  return proof;
}

async function main() {
  log('commander_start', {
    lm_endpoint: LM_URL,
    model: LM_MODEL,
    poll_seconds: POLL_SECONDS
  });

  while (true) {
    try {
      const proof = await cycle();
      process.stdout.write(JSON.stringify(proof) + '\n');
    } catch (err) {
      log('commander_error', { error: err.message });
    }

    await new Promise(resolve => setTimeout(resolve, POLL_SECONDS * 1000));
  }
}

main().catch(err => {
  log('fatal', { error: err.message });
  process.exit(1);
});
