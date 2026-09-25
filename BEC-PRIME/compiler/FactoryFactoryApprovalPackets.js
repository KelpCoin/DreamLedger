'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const queuePath = path.join(root, 'data', 'factory-factory', 'FACTORY-FACTORY-QUEUE.json');
const outDir = path.join(root, 'data', 'factory-factory', 'approval-packets');

function run() {
  const queue = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
  const candidates = Array.isArray(queue.queue) ? queue.queue : [];
  const packets = candidates.slice(0, 10).map(x => ({
    packet_id: 'APPROVAL-' + x.experiment_id,
    experiment_id: x.experiment_id,
    opportunity_id: x.opportunity_id,
    title: x.title,
    buyer: x.demand.buyer,
    offer: x.proposition.offer,
    price_nzd: x.proposition.price_nzd,
    smallest_test: x.proposition.smallest_test,
    acquisition_surface: x.execution.acquisition_surface,
    fulfillment: x.execution.fulfillment,
    evidence_required: x.truth.verification_required,
    external_action_required: true,
    approval_required: true,
    revenue_claim: 'TRUTH_ORACLE_ONLY',
    state: 'AWAITING_HUMAN_AUTHORIZATION'
  }));

  const payload = {
    schema_version: 'DREAMLEDGER/FACTORY-FACTORY-APPROVAL-PACKETS/v1',
    generated_at_utc: new Date().toISOString(),
    source_queue: queuePath,
    packet_count: packets.length,
    packets
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'latest.json'), JSON.stringify(payload, null, 2) + '\n');
  return payload;
}

if (require.main === module) console.log(JSON.stringify(run(), null, 2));
module.exports = { run };