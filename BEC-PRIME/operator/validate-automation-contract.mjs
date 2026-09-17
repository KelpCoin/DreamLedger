import fs from 'node:fs';

const path = 'BEC-PRIME/operator/automation-contract.json';
const required = [
  'runbook_id', 'trigger', 'inputs', 'authority', 'decision', 'action',
  'verification', 'evidence', 'failure', 'escalation', 'resume',
  'idempotency', 'kill_switch', 'human_boundary'
];
const doc = JSON.parse(fs.readFileSync(path, 'utf8'));

if (doc.schema_version !== '1.0') throw new Error('Unsupported automation contract schema');
if (!Array.isArray(doc.required_sequence) || doc.required_sequence.length !== 10) {
  throw new Error('required_sequence must contain the ten control stages');
}
if (!Array.isArray(doc.automation_families) || doc.automation_families.length < 40) {
  throw new Error('automation family registry is incomplete');
}
if (!Array.isArray(doc.minimum_contract_fields) || !required.every(k => doc.minimum_contract_fields.includes(k))) {
  throw new Error('minimum contract fields are incomplete');
}
const expected = ['TRIGGER','INPUTS','AUTHORITY','DECISION','ACTION','VERIFICATION','EVIDENCE','FAILURE','ESCALATION','RESUME'];
if (JSON.stringify(doc.required_sequence) !== JSON.stringify(expected)) throw new Error('control sequence drift');

console.log(JSON.stringify({
  status: 'PASS',
  schema_version: doc.schema_version,
  automation_families: doc.automation_families.length,
  required_sequence: doc.required_sequence,
  minimum_contract_fields: doc.minimum_contract_fields.length
}, null, 2));
