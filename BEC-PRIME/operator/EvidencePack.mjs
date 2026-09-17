import fs from 'node:fs';
import crypto from 'node:crypto';

const inputPath = process.argv[2];
if (!inputPath) throw new Error('Usage: node EvidencePack.mjs <input.json> [output.json]');
const outputPath = process.argv[3] || 'evidence-pack.json';
const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.keys(value).sort().reduce((o,k) => { o[k] = canonical(value[k]); return o; }, {}) : value;
const hash = value => crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(canonical(value))).digest('hex');
const observations = Array.isArray(input.observations) ? input.observations : [];
const pack = {
  schema_version: '1.0',
  generated_at: new Date().toISOString(),
  pack_id: input.pack_id || hash({runbook_id: input.runbook_id, observations}),
  runbook_id: input.runbook_id || 'UNSPECIFIED',
  subject: input.subject || 'AUTONOMOUS REVENUE ENGINE',
  authority: input.authority || 'UNSPECIFIED',
  observations: observations.map((o, i) => ({
    sequence: i + 1,
    id: o.id || null,
    status: o.status || 'UNKNOWN',
    observed_at: o.observed_at || null,
    source: o.source || null,
    authority: o.authority || input.authority || null,
    evidence_ref: o.evidence_ref || null,
    input_hash: o.input_hash || hash(o.input),
    output_hash: o.output_hash || hash(o.output),
    consequence: o.consequence || null
  })),
  decisions: Array.isArray(input.decisions) ? input.decisions : [],
  actions: Array.isArray(input.actions) ? input.actions : [],
  unresolved: Array.isArray(input.unresolved) ? input.unresolved : [],
  verification: input.verification || {status: 'NOT_RUN'},
  controls: {
    kill_switch: input.kill_switch || 'UNSPECIFIED',
    idempotency_key: input.idempotency_key || hash({runbook_id: input.runbook_id, observations})
  }
};
pack.pack_sha256 = hash(pack);
fs.writeFileSync(outputPath, JSON.stringify(pack, null, 2) + '\n');
console.log(JSON.stringify({status:'PASS', output:outputPath, pack_sha256:pack.pack_sha256, observations:pack.observations.length, unresolved:pack.unresolved.length}, null, 2));
