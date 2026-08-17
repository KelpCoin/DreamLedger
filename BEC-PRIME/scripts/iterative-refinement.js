'use strict';

const fs = require('fs');

const base = process.env.LLM_API_URL || 'http://127.0.0.1:1234/v1/chat/completions';
const apiKey = process.env.LLM_API_KEY || 'lm-studio';
const models = (process.env.LLM_MODELS || process.env.LLM_MODEL || 'local-model').split(',').map(s => s.trim()).filter(Boolean);
const prompt = process.env.REFINEMENT_PROMPT || 'Review the current DreamLedger control-plane contract. Propose only safe, minimal improvements. Preserve approval gates, silo separation, evidence-before-claims, and revenue truth.';

async function callModel(model, messages) {
  const response = await fetch(base, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, temperature: 0.2 })
  });
  if (!response.ok) throw new Error(`LLM_HTTP_${response.status}`);
  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

async function main() {
  const proposer = await callModel(models[0], [{ role: 'system', content: 'You are the proposer. Return a compact engineering proposal.' }, { role: 'user', content: prompt }]);
  const critic = await callModel(models[Math.min(1, models.length - 1)], [{ role: 'system', content: 'You are the critic. Attack this proposal for security, silo leakage, fake economic claims, and unnecessary complexity.' }, { role: 'user', content: proposer }]);
  const synthesizer = await callModel(models[Math.min(2, models.length - 1)], [{ role: 'system', content: 'You are the synthesizer. Produce the smallest safe next-step plan from the proposal and critique. Do not claim execution.' }, { role: 'user', content: `PROPOSAL:\n${proposer}\n\nCRITIQUE:\n${critic}` }]);
  const out = [
    '# Iterative Refinement Proof',
    `UTC=${new Date().toISOString()}`,
    `ENDPOINT=${base}`,
    `MODELS=${models.join(',')}`,
    'REVENUE_CLAIM=NOT_VERIFIED_BY_AUTOMATION',
    '', '## PROPOSER', proposer,
    '', '## CRITIC', critic,
    '', '## SYNTHESIZER', synthesizer
  ].join('\n');
  const output = process.env.REFINEMENT_OUT || 'artifacts/iterative-refinement-proof.md';
  fs.mkdirSync(require('path').dirname(output), { recursive: true });
  fs.writeFileSync(output, out + '\n', 'utf8');
  console.log(`REFINEMENT_PROOF=${output}`);
}
main().catch(err => { console.error(`REFINEMENT_FAIL=${err.message}`); process.exit(1); });
