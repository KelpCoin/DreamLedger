'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dir = path.join(root, 'data', 'factory-factory');

const files = [
  'FACTORY-FACTORY-QUEUE.json',
  'FACTORY-FACTORY-RUN.json',
  'MONEY-CELLS.json',
  'UNIVERSAL-MONEY-CELLS.json',
  'orchestrator/latest.json'
];

for (const name of files) {
  if (!fs.existsSync(path.join(dir, name))) throw new Error('Missing factory artifact: ' + name);
}

const run = JSON.parse(fs.readFileSync(path.join(dir, 'FACTORY-FACTORY-RUN.json'), 'utf8'));
const orch = JSON.parse(fs.readFileSync(path.join(dir, 'orchestrator', 'latest.json'), 'utf8'));

if (run.external_action !== 'NOT_PERFORMED') throw new Error('Factory crossed external action boundary');
if (run.external_revenue !== 'UNVERIFIED') throw new Error('Factory claimed revenue');
if (run.business_truth !== 'NOT_CLAIMED') throw new Error('Factory claimed BusinessTruth');
if (orch.economic_truth?.revenue !== 'UNVERIFIED') throw new Error('Orchestrator claimed revenue');
if (orch.acquisition_boundary?.publication !== 'APPROVAL_REQUIRED') throw new Error('Publication gate missing');
if (orch.acquisition_boundary?.charge !== 'APPROVAL_REQUIRED') throw new Error('Charge gate missing');

console.log(JSON.stringify({
  schema: 'DREAMLEDGER/FACTORY-FACTORY-ECONOMIC-BOUNDARY/v1',
  status: 'PASS',
  selected_count: orch.selected_count,
  universal_count: orch.universal_count,
  acquisition_packets: orch.acquisition_packet_count,
  replication_eligible: orch.replication_eligible_count,
  external_action: run.external_action,
  external_revenue: run.external_revenue
}, null, 2));
