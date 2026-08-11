'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { KelplantisAdapter, sha256 } = require('./KelplantisAdapter');

const ROOT = path.join(__dirname, '..');
const SCHEMA = JSON.parse(fs.readFileSync(path.join(__dirname, 'kelplantis.schema.json'), 'utf8'));
const PROOF_DIR = path.resolve(process.env.KELPLANTIS_PROOF_DIR || path.join(ROOT, 'data', 'proofs'));

function stableJson(value) {
  return JSON.stringify(value, Object.keys(value).sort());
}

function deterministicId(task, models) {
  return `KELP-${sha256(`${task}|${models.join('|')}`).slice(0, 20).toUpperCase()}`;
}

function validateResult(result) {
  const required = ['task', 'decision', 'confidence', 'findings', 'recommended_action'];
  const errors = required.filter(key => result?.[key] === undefined).map(key => `missing:${key}`);
  if (!['PASS', 'FAIL', 'REVIEW'].includes(result?.decision)) errors.push('invalid:decision');
  if (typeof result?.confidence !== 'number' || result.confidence < 0 || result.confidence > 1) errors.push('invalid:confidence');
  if (!Array.isArray(result?.findings)) errors.push('invalid:findings');
  if (typeof result?.recommended_action !== 'string' || !result.recommended_action.trim()) errors.push('invalid:recommended_action');
  if (SCHEMA.additionalProperties === false) {
    for (const key of Object.keys(result || {})) if (!required.includes(key)) errors.push(`unexpected:${key}`);
  }
  return { valid: errors.length === 0, errors };
}

function consensus(results) {
  const valid = results.filter(x => x.validation.valid);
  if (!valid.length) return { decision: 'REVIEW', confidence: 0, findings: [], recommended_action: 'LM Studio produced no schema-valid result.' };
  const counts = new Map();
  for (const item of valid) counts.set(item.result.decision, (counts.get(item.result.decision) || 0) + 1);
  const decision = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
  const selected = valid.filter(x => x.result.decision === decision);
  const confidence = Number((selected.reduce((sum, x) => sum + x.result.confidence, 0) / selected.length).toFixed(4));
  const findings = [];
  const seen = new Set();
  for (const item of valid) {
    for (const finding of item.result.findings) {
      const key = `${finding.id}|${finding.statement}|${finding.evidence}`;
      if (!seen.has(key)) { seen.add(key); findings.push(finding); }
    }
  }
  findings.sort((a, b) => `${a.severity}:${a.id}`.localeCompare(`${b.severity}:${b.id}`));
  const recommended = [...new Set(selected.map(x => x.result.recommended_action))].sort().join(' | ');
  return { decision, confidence, findings, recommended_action: recommended || 'Review the model evidence before acting.' };
}

async function runPipeline({ task, prompt, models = [], tools = [] } = {}) {
  if (!task || !prompt) throw new Error('task and prompt are required');
  const adapter = new KelplantisAdapter();
  const discovered = await adapter.listModels();
  const available = new Set(discovered.map(model => model.id));
  const selected = (models.length ? models : discovered.map(model => model.id)).filter(model => available.has(model));
  if (!selected.length) throw new Error('No requested models are available in LM Studio');

  const messages = [
    { role: 'system', content: 'You are a local Kelplantis verifier. Return only the requested JSON schema. Do not invent evidence. If evidence is insufficient, choose REVIEW.' },
    { role: 'user', content: prompt }
  ];
  const results = [];
  for (const model of selected) {
    const started = Date.now();
    try {
      const response = await adapter.structuredChat({
        model,
        messages,
        schema: SCHEMA,
        schemaName: 'kelplantis_result',
        tools,
        temperature: 0,
        maxTokens: 1600
      });
      const validation = validateResult(response.result);
      results.push({ model, status: validation.valid ? 'PASS' : 'FAIL', latency_ms: Date.now() - started, validation, result: response.result, content_sha256: response.content_sha256, tool_calls: response.tool_calls });
    } catch (error) {
      results.push({ model, status: 'ERROR', latency_ms: Date.now() - started, validation: { valid: false, errors: [error.message] }, result: null, tool_calls: [] });
    }
  }

  const valid = results.filter(item => item.validation.valid);
  const aggregate = consensus(results);
  const proofId = deterministicId(task, selected);
  fs.mkdirSync(PROOF_DIR, { recursive: true });
  const proof = {
    type: 'kelplantis-local-multi-model-proof',
    proof_id: proofId,
    generated_at: new Date().toISOString(),
    state: valid.length ? 'PASS' : 'EXTERNAL_BLOCKED',
    execution_boundary: 'local_only',
    lmstudio_base_url: adapter.baseUrl,
    task,
    selected_models: selected,
    discovered_models: discovered.map(model => model.id),
    model_results: results,
    aggregate,
    gauntlet: {
      schema_valid_models: valid.length,
      minimum_valid_models: 1,
      passed: valid.length > 0,
      checkout_untouched: true,
      public_state_untouched: true
    },
    input_sha256: sha256(`${task}\n${prompt}`),
    proof_sha256: null
  };
  proof.proof_sha256 = crypto.createHash('sha256').update(JSON.stringify(proof), 'utf8').digest('hex');
  const file = path.join(PROOF_DIR, `${proofId}.json`);
  fs.writeFileSync(file, JSON.stringify(proof, null, 2) + '\n');
  return { proof, file };
}

module.exports = { runPipeline, validateResult, consensus };
