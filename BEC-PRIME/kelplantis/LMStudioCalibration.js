'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { KelplantisAdapter, sha256 } = require('./KelplantisAdapter');

const ROOT = path.join(__dirname, '..');
const PROOF_DIR = path.resolve(process.env.LMSTUDIO_PROOF_DIR || path.join(ROOT, 'RUN-PROOFS', 'LMStudio'));
const BANK = process.env.CHATGPT_MEMORY_BANK || 'C:\\Users\\GGPC\\Desktop\\chatgpt memory bank';
const ROLE_ORDER = ['proposer', 'critic', 'synthesizer'];

function scoreModel(model) {
  const id = String(model.id || '').toLowerCase();
  const caps = model.capabilities || {};
  const score = {
    proposer: 0,
    critic: 0,
    synthesizer: 0,
    coding: 0,
    structured: 0
  };
  if (/qwen|coder|code|deepseek/.test(id)) score.coding += 4;
  if (/gpt|qwen|llama|mistral|phi/.test(id)) score.synthesizer += 2;
  if (/gpt|qwen|llama|mistral/.test(id)) score.critic += 2;
  if (/phi/.test(id)) score.proposer += 2;
  if (caps.tool_choice || caps.tools) score.structured += 2;
  if (caps.response_format || caps.json_schema) score.structured += 3;
  score.proposer += 1;
  score.critic += 1;
  score.synthesizer += 1;
  return score;
}

function chooseRoles(models) {
  const ranked = models.map(m => ({ id: m.id, score: scoreModel(m) }));
  const used = new Set();
  const assignments = {};
  for (const role of ROLE_ORDER) {
    const candidate = [...ranked].sort((a, b) => (b.score[role] - a.score[role]) || a.id.localeCompare(b.id)).find(x => !used.has(x.id));
    if (candidate) { assignments[role] = candidate.id; used.add(candidate.id); }
  }
  if (!assignments.synthesizer && ranked[0]) assignments.synthesizer = ranked[0].id;
  return { assignments, ranked };
}

function bankStatus() {
  try {
    const stat = fs.statSync(BANK);
    if (!stat.isDirectory()) return { status: 'INVALID', path: BANK };
    const entries = fs.readdirSync(BANK, { withFileTypes: true });
    return { status: 'FOUND', path: BANK, top_level_entries: entries.length };
  } catch (error) {
    return { status: 'NOT_REACHABLE', path: BANK, error: error.message };
  }
}

async function probe() {
  const adapter = new KelplantisAdapter({ timeoutMs: 8000, retries: 1 });
  const started = Date.now();
  const health = await adapter.health();
  const models = health.status === 'ok' ? await adapter.listModels() : [];
  const roles = chooseRoles(models);
  const proof = {
    proof_type: 'LMSTUDIO_CONTINUOUS_CALIBRATION',
    generated_at: new Date().toISOString(),
    base_url: adapter.baseUrl,
    health,
    discovered_models: models.map(m => ({ id: m.id, object: m.object, owned_by: m.owned_by, capabilities: m.capabilities || {} })),
    role_assignments: roles.assignments,
    ranked_models: roles.ranked,
    memory_bank: bankStatus(),
    known_model_targets: ['Phi-3 Mini 4K Instruct', 'Qwen 2.5 Coder 14B Instruct', 'GPT-OSS 20B'],
    calibration_policy: {
      discovery: 'always query /models; never hard-code model availability',
      selection: 'capability/name scoring with deterministic tie-break',
      temperature: 0,
      no_cloud_fallback: true,
      memory_bank_is_local_only: true,
      secrets_written: false
    },
    elapsed_ms: Date.now() - started,
    proof_sha256: null
  };
  proof.proof_sha256 = crypto.createHash('sha256').update(JSON.stringify(proof), 'utf8').digest('hex');
  fs.mkdirSync(PROOF_DIR, { recursive: true });
  const file = path.join(PROOF_DIR, `LMSTUDIO-CALIBRATION-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify(proof, null, 2) + '\n', 'utf8');
  return proof;
}

if (require.main === module) {
  probe().then(p => {
    process.stdout.write(JSON.stringify(p, null, 2) + '\n');
    process.exitCode = p.health.status === 'ok' ? 0 : 2;
  }).catch(error => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { probe, chooseRoles, scoreModel, bankStatus };
