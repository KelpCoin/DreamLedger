'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dir = path.join(root, 'data', 'factory-factory');

const required = [
  'FACTORY-FACTORY-QUEUE.json',
  'FACTORY-FACTORY-RUN.json',
  'MONEY-CELLS.json',
  'UNIVERSAL-MONEY-CELLS.json',
  'FACTORY-FACTORY-CYCLE.json',
  'orchestrator/latest.json'
];

for (const name of required) {
  const file = path.join(dir, name);
  if (!fs.existsSync(file)) throw new Error('Missing factory artifact: ' + name);
}

const run = JSON.parse(fs.readFileSync(path.join(dir, 'FACTORY-FACTORY-RUN.json'), 'utf8'));
const universal = JSON.parse(fs.readFileSync(path.join(dir, 'UNIVERSAL-MONEY-CELLS.json'), 'utf8'));
const cycle = JSON.parse(fs.readFileSync(path.join(dir, 'FACTORY-FACTORY-CYCLE.json'), 'utf8'));
const orchestrator = JSON.parse(fs.readFileSync(path.join(dir, 'orchestrator/latest.json'), 'utf8'));

if (!Array.isArray(run.cells)) throw new Error('Factory run has no cells array');
if (!Array.isArray(universal.cells)) throw new Error('Universal factory has no cells array');
if (run.external_action !== 'NOT_PERFORMED') throw new Error('Factory run crossed external-action boundary');
if (run.external_revenue !== 'UNVERIFIED') throw new Error('Factory run claimed revenue');
if (run.business_truth !== 'NOT_CLAIMED') throw new Error('Factory run claimed BusinessTruth');
if (cycle.external_action !== 'NOT_PERFORMED') throw new Error('Cycle crossed external-action boundary');
if (orchestrator.selected_count !== run.cells.length) throw new Error('Orchestrator is not consuming FactoryFactory cells');
if (orchestrator.acquisition_packet_count !== orchestrator.selected_count) throw new Error('Acquisition packets do not cover selected cells');
for (const packet of Object.values(orchestrator.acquisition_packets || {})) {
  if (packet.authorization?.publication !== 'APPROVAL_REQUIRED') throw new Error('Publication gate missing');
  if (packet.authorization?.charge !== 'APPROVAL_REQUIRED') throw new Error('Charge gate missing');
  if (packet.truth?.revenue_claim !== 'TRUTH_ORACLE_ONLY') throw new Error('Truth boundary missing');
}

console.log(JSON.stringify({
  schema: 'DREAMLEDGER/FACTORY-FACTORY-ASSEMBLY-VERIFY/v1',
  status: 'PASS',
  factory_cells: run.cells.length,
  universal_cells: universal.cells.length,
  acquisition_packets: orchestrator.acquisition_packet_count,
  external_action: cycle.external_action,
  external_revenue: cycle.external_revenue,
  business_truth: cycle.business_truth
}, null, 2));
