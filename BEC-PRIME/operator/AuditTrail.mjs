import fs from 'node:fs';
import crypto from 'node:crypto';

const inputPath = process.argv[2];
if (!inputPath) throw new Error('Usage: node AuditTrail.mjs <event.json> [trail.jsonl]');
const outputPath = process.argv[3] || '.promotion/operator-audit.jsonl';
const event = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
fs.mkdirSync(outputPath.split('/').slice(0,-1).join('/') || '.', {recursive:true});
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.keys(value).sort().reduce((o,k) => {o[k]=canonical(value[k]); return o;}, {}) : value;
const hash = value => crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const previous = fs.existsSync(outputPath) ? fs.readFileSync(outputPath,'utf8').trim().split('\n').filter(Boolean).at(-1) : null;
const previous_hash = previous ? hash(JSON.parse(previous)) : null;
const record = {
  schema_version:'1.0',
  sequence: previous ? fs.readFileSync(outputPath,'utf8').trim().split('\n').filter(Boolean).length + 1 : 1,
  recorded_at:new Date().toISOString(),
  event_id:event.event_id || crypto.randomUUID(),
  runbook_id:event.runbook_id || 'UNSPECIFIED',
  actor:event.actor || 'AUTOMATION',
  action:event.action || 'UNSPECIFIED',
  status:event.status || 'UNKNOWN',
  authority:event.authority || 'UNSPECIFIED',
  input_hash:event.input_hash || hash(event.input || event),
  output_hash:event.output_hash || hash(event.output || {}),
  evidence_ref:event.evidence_ref || null,
  consequence:event.consequence || null,
  previous_hash
};
record.record_sha256 = hash(record);
fs.appendFileSync(outputPath, JSON.stringify(record)+'\n');
console.log(JSON.stringify({status:'PASS', output:outputPath, sequence:record.sequence, record_sha256:record.record_sha256},null,2));
