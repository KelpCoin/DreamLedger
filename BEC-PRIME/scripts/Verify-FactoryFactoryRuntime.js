'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const orchestrator = path.join(root, 'data', 'factory-factory', 'orchestrator', 'latest.json');
if (!fs.existsSync(orchestrator)) throw new Error('orchestrator output missing');

const doc = JSON.parse(fs.readFileSync(orchestrator, 'utf8'));
if (doc.mode !== 'BOUNDED_AUTONOMOUS_ECONOMIC_PREPARATION') throw new Error('unexpected orchestrator mode');

const invariants = new Set(doc.invariants || []);
for (const required of [
  'No buyer is invented.',
  'No payment is invented.',
  'No revenue is inferred from internal activity.',
  'No external publication occurs from this process.',
  'No spend occurs from this process.',
  'No charge occurs from this process.',
  'Replication requires verified external economic evidence.'
]) {
  if (!invariants.has(required)) throw new Error('missing invariant: ' + required);
}

for (const [id, packet] of Object.entries(doc.acquisition_packets || {})) {
  if (!packet.experiment_id || packet.experiment_id !== id) throw new Error('packet identity mismatch: ' + id);
  if (!packet.offer || !packet.offer.title) throw new Error('packet missing offer title: ' + id);
  if (!Number.isFinite(Number(packet.offer.price_nzd)) || Number(packet.offer.price_nzd) <= 0) throw new Error('packet invalid price: ' + id);
  if (!Array.isArray(packet.channel)) throw new Error('packet channel is not an array: ' + id);
  if (packet.authorization?.publication !== 'APPROVAL_REQUIRED') throw new Error('publication gate missing: ' + id);
  if (packet.authorization?.outreach !== 'APPROVAL_REQUIRED') throw new Error('outreach gate missing: ' + id);
  if (packet.authorization?.spend !== 'APPROVAL_REQUIRED') throw new Error('spend gate missing: ' + id);
  if (packet.authorization?.charge !== 'APPROVAL_REQUIRED') throw new Error('charge gate missing: ' + id);
  if (packet.truth?.revenue_claim !== 'TRUTH_ORACLE_ONLY') throw new Error('truth gate missing: ' + id);
}

console.log(JSON.stringify({
  status: 'PASS',
  selected_count: doc.selected_count,
  acquisition_packet_count: doc.acquisition_packet_count,
  external_action: 'NOT_PERFORMED',
  revenue: 'UNVERIFIED',
  business_truth: 'NOT_CLAIMED'
}, null, 2));
