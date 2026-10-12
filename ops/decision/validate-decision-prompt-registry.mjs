#!/usr/bin/env node
'use strict';
// Static validation only. This script never calls a model, changes production state, or counts revenue.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root = process.cwd();
const registryPath = path.join(root, 'ops/decision/decision-prompt-registry.json');
const outDir = path.join(root, 'proof/decision');
const outPath = path.join(outDir, 'latest-decision-prompt-registry-validation.json');
const fail = [];
let registry;
try { registry = JSON.parse(fs.readFileSync(registryPath, 'utf8')); }
catch (e) { console.error('Cannot parse decision prompt registry:', e.message); process.exit(2); }
if (registry.visibility !== 'INTERNAL_ONLY') fail.push('Registry must be internal-only.');
if (registry.policy?.model_output_is_evidence !== false) fail.push('Model output must never count as evidence.');
if (registry.policy?.confidence_is_proof !== false) fail.push('Confidence must never count as proof.');
if (registry.policy?.external_action_requires_human_approval !== true) fail.push('External actions must require human approval.');
if (!Array.isArray(registry.prompts) || registry.prompts.length !== 16) fail.push('Expected exactly 16 registered prompts.');
const ids = new Set();
for (const p of registry.prompts || []) {
  if (!p.id || ids.has(p.id)) fail.push('Missing or duplicate prompt id: ' + (p.id || '(empty)'));
  ids.add(p.id);
  if (!p.prompt || !p.input || !p.task) fail.push('Incomplete prompt contract: ' + p.id);
  if (/Gauntlet|Elohim|777|Figure Eight/i.test(p.prompt) && p.id !== 'decision.gauntlet.verdict') {
    // These names are allowed in the internal registry only; the validator itself never publishes prompts.
  }
}
const digest = crypto.createHash('sha256').update(fs.readFileSync(registryPath)).digest('hex');
const result = {
  schema_version: registry.schema_version,
  status: fail.length ? 'FAIL' : 'PASS',
  visibility: 'INTERNAL_ONLY',
  prompt_count: registry.prompts?.length || 0,
  unique_prompt_ids: ids.size,
  model_calls_made: 0,
  production_changes_made: 0,
  revenue_claimed_nzd: 0,
  registry_sha256: digest,
  failures: fail,
  generated_at: new Date().toISOString()
};
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(result, null, 2));
console.log('Proof: ' + path.relative(root, outPath));
process.exit(fail.length ? 1 : 0);
