'use strict';

const DEFAULT_BRIDGE_URL = process.env.BEC_AGENT_BRIDGE_URL || process.env.AGENT_BRIDGE_URL || 'http://127.0.0.1:3000';
const STAGE_PATH = '/api/agent-bridge/rail/stage';

async function verifyAndStage(bridgeResult, options = {}) {
  if (!bridgeResult || bridgeResult.status !== 'LEASED_AND_EXECUTED') throw new Error('A completed Worker A bridge result is required');
  const lease = bridgeResult.lease;
  const result = bridgeResult.result;
  if (!lease?.envelope || !lease?.signature || !result) throw new Error('Bridge result is missing lease or worker result');

  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const baseUrl = String(options.baseUrl || DEFAULT_BRIDGE_URL).replace(/\/$/, '');
  const token = String(options.token || process.env.DREAMLEDGER_AGENT_BRIDGE_TOKEN || '');
  const verifierId = String(options.verifierId || process.env.BEC_VERIFIER_ID || 'truth-oracle').trim().toLowerCase();
  if (!token) throw new Error('DREAMLEDGER_AGENT_BRIDGE_TOKEN is required');
  if (!verifierId || verifierId === String(lease.envelope.worker_id).toLowerCase()) throw new Error('Independent verifier identity is required');

  const verification = {
    verifier: verifierId,
    observed_worker_a: true,
    job_id: lease.envelope.job_id,
    lease_id: lease.envelope.lease_id,
    worker_id: lease.envelope.worker_id,
    worker_a_status: result.status,
    worker_a_result_hash: result.proof_ref || null,
    payment_claim: Boolean(result.evidence_claims?.payment_claim),
    sale_claim: Boolean(result.evidence_claims?.sale_claim),
    fulfillment_claim: Boolean(result.evidence_claims?.fulfillment_claim),
    irreversible_effects_triggered: Boolean(result.irreversible_effects_triggered),
    independently_verified: true,
    verification_rule: 'Observed signed Worker A result; no payment, sale, fulfillment, or irreversible effect is asserted by this verifier.'
  };

  const response = await fetchImpl(`${baseUrl}${STAGE_PATH}`, {
    method: 'POST',
    headers: {
      'x-dreamledger-agent-token': token,
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      envelope: lease.envelope,
      signature: lease.signature,
      worker_id: lease.envelope.worker_id,
      actor_id: verifierId,
      stage: 'WORKER_B_RESULT',
      result: verification
    })
  });
  const text = await response.text();
  let body;
  try { body = JSON.parse(text || 'null'); } catch { throw new Error(`Bridge verifier returned invalid JSON (${response.status})`); }
  if (!response.ok) throw new Error(body?.error || `Bridge verifier failed (${response.status})`);
  return body;
}

if (require.main === module) {
  const fs = require('fs');
  const input = JSON.parse(fs.readFileSync(process.argv[2] || 'bridge-worker-result.json', 'utf8'));
  verifyAndStage(input).then(result => console.log(JSON.stringify(result, null, 2))).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { verifyAndStage };
