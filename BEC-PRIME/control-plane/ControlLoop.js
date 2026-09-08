'use strict';

// Minimal Phase-0 control loop. Deliberately reuses the existing local LM Studio
// adapter and proof conventions rather than creating a second agent stack.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { KelplantisAdapter, sha256 } = require('../kelplantis/KelplantisAdapter');

const ROOT = path.join(__dirname, '..');
const PROOF_DIR = path.join(ROOT, 'RUN-PROOFS', 'CONTROL-PLANE');
const ORACLE_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['verdict','confidence','claims','missing_evidence','sources','reasoning'],
  properties: {
    verdict: { type: 'string', enum: ['VERIFIED','UNVERIFIED','CONTRADICTED','STALE'] },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    claims: { type: 'array', items: { type: 'string' } },
    missing_evidence: { type: 'array', items: { type: 'string' } },
    sources: { type: 'array', items: { type: 'string' } },
    reasoning: { type: 'string' }
  }
};
const GAUNTLET_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['verdict','confidence','attacks','economic_risks','operational_risks','recommended_action'],
  properties: {
    verdict: { type: 'string', enum: ['PASS','FAIL','QUARANTINE','NEEDS_EVIDENCE'] },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    attacks: { type: 'array', items: { type: 'string' } },
    economic_risks: { type: 'array', items: { type: 'string' } },
    operational_risks: { type: 'array', items: { type: 'string' } },
    recommended_action: { type: 'string' }
  }
};

function stableId(proposal) {
  return `CP-${crypto.createHash('sha256').update(proposal, 'utf8').digest('hex').slice(0, 20).toUpperCase()}`;
}

async function evaluate(proposal, options = {}) {
  if (!proposal || !proposal.trim()) throw new Error('proposal must not be empty');
  const adapter = new KelplantisAdapter();
  const discovered = await adapter.listModels();
  if (!discovered.length) throw new Error('No LM Studio models discovered');
  const oracleModel = options.oracleModel || discovered[0].id;
  const gauntletModel = options.gauntletModel || discovered[1]?.id || discovered[0].id;
  const base = `Proposal:\n${proposal.trim()}\n\nDo not invent evidence. Distinguish absence of evidence from evidence of absence. This is a pre-execution gate: recommend REVIEW/NEEDS_EVIDENCE when the proposal cannot be established safely.`;
  const oracle = await adapter.structuredChat({
    model: oracleModel,
    messages: [
      { role: 'system', content: 'You are TRUTH ORACLE. Independently verify the proposal claims. You may use only evidence actually supplied or available through explicitly configured tools. Return only the requested JSON.' },
      { role: 'user', content: base }
    ], schema: ORACLE_SCHEMA, schemaName: 'truth_oracle', temperature: 0, maxTokens: 1400
  });
  const gauntlet = await adapter.structuredChat({
    model: gauntletModel,
    messages: [
      { role: 'system', content: 'You are GAUNTLET. Attack the proposal before any side effect. Test failure modes, scope drift, economic weakness, operational fragility, and unsafe assumptions. Return only the requested JSON.' },
      { role: 'user', content: `${base}\n\nAdversarial categories: prompt/instruction conflict, false premises, scope creep, malformed inputs, runaway behavior, data exposure, dependency failure, economic failure, rollback failure.` }
    ], schema: GAUNTLET_SCHEMA, schemaName: 'gauntlet', temperature: 0, maxTokens: 1600
  });
  const runId = stableId(proposal);
  const result = {
    control_loop_version: '0.1.0', run_id: runId, generated_at: new Date().toISOString(),
    stage: 'HUMAN_APPROVAL_REQUIRED', proposal: proposal.trim(),
    models: { oracle: oracleModel, gauntlet: gauntletModel, discovered: discovered.map(x => x.id) },
    oracle: oracle.result, gauntlet: gauntlet.result,
    approval: { status: 'PENDING', approved_by: null, approved_at: null },
    telemetry: { event_id: crypto.randomUUID(), market_result: null },
    authority: { execution_permitted: false, public_mutation_permitted: false },
    hashes: { proposal_sha256: sha256(proposal.trim()), oracle_sha256: oracle.content_sha256, gauntlet_sha256: gauntlet.content_sha256 }
  };
  fs.mkdirSync(PROOF_DIR, { recursive: true });
  const file = path.join(PROOF_DIR, `${runId}.json`);
  fs.writeFileSync(file, JSON.stringify(result, null, 2) + '\n');
  return { result, file };
}

if (require.main === module) {
  const file = process.argv[2];
  if (!file) { console.error('Usage: node ControlLoop.js <proposal.md>'); process.exit(2); }
  const proposal = fs.readFileSync(path.resolve(file), 'utf8');
  evaluate(proposal).then(({ result, file: out }) => {
    console.log(JSON.stringify({ run_id: result.run_id, oracle: result.oracle.verdict, gauntlet: result.gauntlet.verdict, approval: result.approval.status, file: out }, null, 2));
  }).catch(error => { console.error(error.stack || error.message); process.exit(1); });
}

module.exports = { evaluate, stableId, ORACLE_SCHEMA, GAUNTLET_SCHEMA };
