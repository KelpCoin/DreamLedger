'use strict';

const { runNext } = require('./EconomicJobWorkerAdapter');
const { verifyAndStage } = require('./BridgeRailVerifier');

let running = false;

function configured() {
  return Boolean(
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.DREAMLEDGER_AGENT_BRIDGE_TOKEN
  );
}

async function tick({ port, workerId = 'render-worker' } = {}) {
  if (running || !configured()) return { status: running ? 'BUSY' : 'NOT_CONFIGURED' };
  running = true;
  const baseUrl = `http://127.0.0.1:${Number(port)}`;
  try {
    const result = await runNext({
      baseUrl,
      workerId,
      token: process.env.DREAMLEDGER_AGENT_BRIDGE_TOKEN
    });
    if (result.status === 'IDLE') return result;
    const verification = await verifyAndStage(result, {
      baseUrl,
      verifierId: 'truth-oracle',
      token: process.env.DREAMLEDGER_AGENT_BRIDGE_TOKEN
    });
    return {
      status: 'COMPLETED',
      job_id: result.lease.envelope.job_id,
      lease_id: result.lease.envelope.lease_id,
      worker_id: result.lease.envelope.worker_id,
      verifier_id: verification.actor_id || 'truth-oracle',
      stage_a: result.stage_a,
      stage_b: verification
    };
  } finally {
    running = false;
  }
}

function start({ port, intervalMs = 60000, workerId = 'render-worker' } = {}) {
  if (!Number.isInteger(Number(port)) || Number(port) <= 0) return null;
  const execute = () => tick({ port, workerId }).then(result => {
    if (result.status !== 'IDLE' && result.status !== 'BUSY' && result.status !== 'NOT_CONFIGURED') {
      console.log('[ProductionBridgeWorker]', JSON.stringify(result));
    }
    return result;
  }).catch(error => {
    console.error('[ProductionBridgeWorker]', error && error.stack ? error.stack : error);
    return null;
  });

  setTimeout(execute, 5000);
  const timer = setInterval(execute, Math.max(15000, Number(intervalMs) || 60000));
  if (typeof timer.unref === 'function') timer.unref();
  return timer;
}

module.exports = { configured, tick, start };
