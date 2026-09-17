import fs from 'node:fs';
import crypto from 'node:crypto';

const inputPath = process.argv[2];
if (!inputPath) throw new Error('Usage: node OperatorPacket.mjs <input.json> [output.json]');
const outputPath = process.argv[3] || 'operator-packet.json';
const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const canonical = value => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.keys(value).sort().reduce((o, k) => { o[k] = canonical(value[k]); return o; }, {});
  return value;
};
const now = new Date().toISOString();
const events = Array.isArray(input.events) ? input.events : [];
const anomalies = events.filter(e => ['FAIL','UNKNOWN','CONTRADICTED','UNMATCHED','TIMEOUT'].includes(String(e.status).toUpperCase()));
const requiredHuman = anomalies.filter(e => e.human_action_required === true || ['UNKNOWN','CONTRADICTED'].includes(String(e.status).toUpperCase()));

const packet = {
  schema_version: '1.0',
  generated_at: now,
  runbook_id: input.runbook_id || 'UNSPECIFIED',
  subject: input.subject || 'AUTONOMOUS OPERATION',
  decision_compression: {
    raw_events: events.length,
    anomalies: anomalies.length,
    human_actions_required: requiredHuman.length,
    unresolved: requiredHuman.length > 0
  },
  summary: {
    what_happened: input.what_happened || (anomalies.length ? `${anomalies.length} anomalous event(s) detected` : 'No anomalies detected'),
    why_it_matters: input.why_it_matters || 'See authoritative evidence references',
    exact_human_decision: input.exact_human_decision || (requiredHuman.length ? 'Resolve the listed unresolved states' : 'NONE')
  },
  evidence: events.map(e => ({
    event_id: e.event_id || null,
    status: e.status || null,
    timestamp: e.timestamp || null,
    authority: e.authority || null,
    evidence_ref: e.evidence_ref || null,
    input_hash: e.input_hash || null,
    output_hash: e.output_hash || null
  })),
  human_packet: requiredHuman.map(e => ({
    event_id: e.event_id || null,
    status: e.status || null,
    consequence: e.consequence || 'UNSPECIFIED',
    evidence_ref: e.evidence_ref || null,
    exact_decision: e.exact_decision || 'REVIEW REQUIRED',
    resume_condition: e.resume_condition || 'Authoritative resolution recorded'
  })),
  controls: {
    idempotency_key: input.idempotency_key || sha256(JSON.stringify(canonical({ runbook_id: input.runbook_id, events }))),
    kill_switch: input.kill_switch || 'UNSPECIFIED',
    automation_status: requiredHuman.length ? 'ESCALATED' : 'AUTOMATICALLY_RESOLVED'
  }
};

packet.packet_sha256 = sha256(JSON.stringify(canonical(packet)));
fs.writeFileSync(outputPath, JSON.stringify(packet, null, 2) + '\n');
console.log(JSON.stringify({ status: 'PASS', output: outputPath, packet_sha256: packet.packet_sha256, ...packet.decision_compression }, null, 2));
