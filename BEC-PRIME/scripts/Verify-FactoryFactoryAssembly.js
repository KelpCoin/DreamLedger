'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dir = path.join(root, 'data', 'factory-factory');

const required = [
  'FACTORY-FACTORY-QUEUE.json',
  'FACTORY-FACTORY-RUN.json',
  'MONEY-CELLS.json',
  'FACTORY-FACTORY-CYCLE.json',
  'orchestrator/latest.json'
];

for (const name of required) {
  const file = path.join(dir, name);
  if (!fs.existsSync(file)) throw new Error('Missing factory artifact: ' + name);
}

const run = JSON.parse(fs.readFileSync(path.join(dir, 'FACTORY-FACTORY-RUN.json'), 'utf8'));
const money = JSON.parse(fs.readFileSync(path.join(dir, 'MONEY-CELLS.json'), 'utf8'));
const cycle = JSON.parse(fs.readFileSync(path.join(dir, 'FACTORY-FACTORY-CYCLE.json'), 'utf8'));
const orchestrator = JSON.parse(fs.readFileSync(path.join(dir, 'orchestrator/latest.json'), 'utf8'));
const seedBankPath = path.join(root, '..', 'ops', 'cube-swarm', 'silo-definitions', 'ASYMMETRIC-LEVERAGE-1000.json');
const seedBank = JSON.parse(fs.readFileSync(seedBankPath, 'utf8'));
const seedOpportunityIds = new Set((seedBank.candidates || []).map(candidate => 'LANE-MANIFEST:' + candidate.silo_id));

if (!Array.isArray(run.cells)) throw new Error('Factory run has no cells array');
if (!Array.isArray(money.cells)) throw new Error('Money-cells artifact has no cells array');
if (money.cell_count !== money.cells.length) throw new Error('Money-cells count does not match its cells array');
if (money.cells.length !== run.cells.length) throw new Error('Money-cells artifact does not match factory run');
if (run.external_action !== 'NOT_PERFORMED') throw new Error('Factory run crossed external-action boundary');
if (run.external_revenue !== 'UNVERIFIED') throw new Error('Factory run claimed revenue');
if (run.business_truth !== 'NOT_CLAIMED') throw new Error('Factory run claimed BusinessTruth');
if (cycle.external_action !== 'NOT_PERFORMED') throw new Error('Cycle crossed external-action boundary');
if (orchestrator.selected_count !== run.cells.length) throw new Error('Orchestrator is not consuming FactoryFactory cells');
if (orchestrator.acquisition_packet_count !== orchestrator.selected_count) throw new Error('Acquisition packets do not cover selected cells');
const seededCells = money.cells.filter(cell =>
  seedOpportunityIds.has(cell.opportunity_id) &&
  Array.isArray(cell.candidate_qualification?.source_hashes) &&
  cell.candidate_qualification.source_hashes.length === 8
);
if (seededCells.length !== 1000) throw new Error('Expected 1,000 source-hashed asymmetric-leverage money cells; got ' + seededCells.length);
for (const cell of seededCells) {
  if (cell.candidate_qualification.market_demand_proven !== false) throw new Error('Candidate demand incorrectly marked proven: ' + cell.opportunity_id);
  if (cell.candidate_qualification.fit_review_required && cell.state !== 'FIT_REVIEW_REQUIRED') throw new Error('Fit-review candidate is not held: ' + cell.opportunity_id);
  if (!cell.candidate_qualification.fit_review_required && cell.state !== 'READY_FOR_AUTHORIZED_ACQUISITION') throw new Error('Non-review candidate state mismatch: ' + cell.opportunity_id);
}
const seededPackets = Object.values(orchestrator.acquisition_packets || {}).filter(packet =>
  seedOpportunityIds.has(packet.opportunity_id) &&
  Array.isArray(packet.candidate_qualification?.source_hashes) &&
  packet.candidate_qualification.source_hashes.length === 8
);
if (seededPackets.length !== 1000) throw new Error('Expected 1,000 acquisition packets with source hashes; got ' + seededPackets.length);
for (const packet of seededPackets) {
  if (packet.candidate_qualification.market_demand_proven !== false) throw new Error('Acquisition packet misrepresents candidate demand: ' + packet.packet_id);
  if (packet.candidate_qualification.fit_review_required && packet.execution_state !== 'FIT_REVIEW_REQUIRED_NO_EXTERNAL_ACTION') throw new Error('Fit-review packet is not held: ' + packet.packet_id);
}
for (const packet of Object.values(orchestrator.acquisition_packets || {})) {
  if (packet.authorization?.publication !== 'APPROVAL_REQUIRED') throw new Error('Publication gate missing');
  if (packet.authorization?.charge !== 'APPROVAL_REQUIRED') throw new Error('Charge gate missing');
  if (packet.truth?.revenue_claim !== 'TRUTH_ORACLE_ONLY') throw new Error('Truth boundary missing');
}

console.log(JSON.stringify({
  schema: 'DREAMLEDGER/FACTORY-FACTORY-ASSEMBLY-VERIFY/v1',
  status: 'PASS',
  factory_cells: run.cells.length,
  money_cells: money.cells.length,
  asymmetric_leverage_candidates: seededCells.length,
  fit_review_holds: seededCells.filter(cell => cell.candidate_qualification.fit_review_required).length,
  source_hashed_acquisition_packets: seededPackets.length,
  acquisition_packets: orchestrator.acquisition_packet_count,
  external_action: cycle.external_action,
  external_revenue: cycle.external_revenue,
  business_truth: cycle.business_truth
}, null, 2));
