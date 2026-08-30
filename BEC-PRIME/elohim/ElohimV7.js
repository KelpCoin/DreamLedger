'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const court = require('../runtime/EconomicCourtV2');

const ROOT = path.join(__dirname, '..');
const PROOF_DIR = path.join(ROOT, 'data', 'proofs');

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
function hash(value) { return crypto.createHash('sha256').update(stable(value), 'utf8').digest('hex'); }
function safeModelOutput(value) {
  if (!value || typeof value !== 'object') return null;
  return { summary: String(value.summary || '').slice(0, 2000), rationale: String(value.rationale || '').slice(0, 4000), claims: Array.isArray(value.claims) ? value.claims.slice(0, 20).map(x => String(x).slice(0, 500)) : [] };
}
async function localModel(input) {
  if (process.env.ELOHIM_V7_LM_STUDIO !== 'true') return null;
  const base = String(process.env.LM_STUDIO_BASE_URL || 'http://127.0.0.1:1234').replace(/\/$/, '');
  const response = await fetch(`${base}/v1/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: process.env.ELOHIM_V7_MODEL || 'local-model', messages: [{ role: 'system', content: 'Return JSON only. You may propose but never approve, publish, charge, execute, delete, or disclose secrets. Never invent payment or customer facts.' }, { role: 'user', content: JSON.stringify(input) }], temperature: 0, max_tokens: 600 }) });
  if (!response.ok) throw new Error(`LM Studio ${response.status}`);
  const body = await response.json();
  const text = String(body?.choices?.[0]?.message?.content || '{}').replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
  return safeModelOutput(JSON.parse(text));
}
async function propose(input) {
  const proposal = court.propose({ action: input.action || 'offer', silo: input.silo || 'CORE', payload: input.payload || {} });
  const model = await localModel({ action: proposal.action, silo: proposal.silo, payload: proposal.payload });
  const record = { type: 'elohim-v7-proposal', proposal_id: proposal.proposal_id, created_at: new Date().toISOString(), proposal, model_output: model, authority: 'PROPOSE_ONLY', forbidden: ['approve','publish','charge','execute','delete','credential_access'], input_hash: hash(input) };
  fs.mkdirSync(PROOF_DIR, { recursive: true });
  fs.writeFileSync(path.join(PROOF_DIR, `${proposal.proposal_id}-ELOHIM.json`), JSON.stringify(record, null, 2) + '\n', 'utf8');
  return record;
}
module.exports = { propose };
