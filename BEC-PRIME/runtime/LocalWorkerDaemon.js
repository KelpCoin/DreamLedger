'use strict';

/**
 * Persistent local worker loop for the existing BECK economic worker rail.
 * It does not create a new transport or authority layer. It polls the
 * canonical AgentBridge job endpoint and executes permitted work through the
 * existing EconomicJobWorkerAdapter -> worker-pool -> LM Studio path.
 */

const { runNext } = require('./EconomicJobWorkerAdapter');

const POLL_MS = Math.max(1000, Number(process.env.BEC_WORKER_POLL_MS || 5000));
const IDLE_LOG_MS = Math.max(POLL_MS, Number(process.env.BEC_WORKER_IDLE_LOG_MS || 60000));
const BRIDGE_URL = process.env.BEC_AGENT_BRIDGE_URL || process.env.AGENT_BRIDGE_URL || 'http://127.0.0.1:3000';
const TOKEN = process.env.DREAMLEDGER_AGENT_BRIDGE_TOKEN || '';

if (!TOKEN) {
  console.error('DREAMLEDGER_AGENT_BRIDGE_TOKEN is required.');
  process.exit(2);
}

let stopping = false;
let lastIdleLog = 0;
let busy = false;

async function tick() {
  if (stopping || busy) return;
  busy = true;
  try {
    const result = await runNext({ baseUrl: BRIDGE_URL, token: TOKEN });
    if (result && result.status !== 'IDLE') {
      console.log(JSON.stringify({
        event: 'WORK_CYCLE_COMPLETE',
        status: result.status || result.job?.status || 'UNKNOWN',
        job_id: result.source_job_id || result.job?.job_id || null,
        worker: result.result?.worker || result.job?.route?.worker?.worker_id || null,
        proof_ref: result.proof_ref || result.proof?.proof_hash || null,
        at: new Date().toISOString()
      }));
    } else if (Date.now() - lastIdleLog >= IDLE_LOG_MS) {
      console.log(JSON.stringify({ event: 'WORKER_IDLE', at: new Date().toISOString() }));
      lastIdleLog = Date.now();
    }
  } catch (error) {
    console.error(JSON.stringify({
      event: 'WORK_CYCLE_ERROR',
      error: error && error.message ? error.message : String(error),
      at: new Date().toISOString()
    }));
  } finally {
    busy = false;
  }
}

function stop(signal) {
  stopping = true;
  console.log(JSON.stringify({ event: 'WORKER_STOPPING', signal, at: new Date().toISOString() }));
}

process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));

console.log(JSON.stringify({
  event: 'WORKER_STARTED',
  bridge_url: BRIDGE_URL,
  poll_ms: POLL_MS,
  lm_url: process.env.BEC_LM_URL || 'http://127.0.0.1:1234/v1/chat/completions',
  lm_model: process.env.BEC_LM_MODEL || 'phi-3-mini-4k-instruct',
  at: new Date().toISOString()
}));

(async () => {
  while (!stopping) {
    await tick();
    if (!stopping) await new Promise(resolve => setTimeout(resolve, POLL_MS));
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
