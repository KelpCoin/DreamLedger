'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const file = path.join(root, 'economic', 'EconomicNorthStar.json');
const errors = [];

if (!fs.existsSync(file)) errors.push('MISSING:EconomicNorthStar.json');

let doc = {};
if (!errors.length) {
  try { doc = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { errors.push('INVALID_JSON:EconomicNorthStar.json'); }
}

const required = [
  ['schema', 'dreamledger/economic-north-star/v1'],
  ['unit_of_progress', 'verified_economic_mechanism'],
  ['economic_truth.revenue_requires', 5],
  ['core_loop', 11],
  ['scoreboard', 11],
  ['factory_factory.role', 'Generate bounded commerce experiments from observed demand and known capabilities, then learn from verified outcomes and generate controlled replications.'],
  ['first_money_gate.preferred_existing_wedge', 'COMMANDER-DECK-DIAGNOSTIC-001']
];

if (doc.schema !== required[0][1]) errors.push('SCHEMA');
if (doc.unit_of_progress !== required[1][1]) errors.push('UNIT_OF_PROGRESS');
if (!Array.isArray(doc.economic_truth?.revenue_requires) || doc.economic_truth.revenue_requires.length !== required[2][1]) errors.push('REVENUE_RULE');
if (!Array.isArray(doc.core_loop) || doc.core_loop.length !== required[3][1]) errors.push('CORE_LOOP');
if (!Array.isArray(doc.scoreboard) || doc.scoreboard.length !== required[4][1]) errors.push('SCOREBOARD');
if (doc.factory_factory?.role !== required[5][1]) errors.push('FACTORY_FACTORY_ROLE');
if (doc.first_money_gate?.preferred_existing_wedge !== required[6][1]) errors.push('FIRST_MONEY_GATE');

const truth = doc.economic_truth || {};
for (const [k,v] of Object.entries({
  internal_test_is_revenue:false,
  checkout_start_is_revenue:false,
  database_row_is_revenue:false,
  generated_asset_is_revenue:false
})) {
  if (truth[k] !== v) errors.push('TRUTH:'+k);
}

const effects = doc.factory_factory?.external_effects || {};
for (const [k,v] of Object.entries({
  spend_without_approval:false,
  contact_without_approval:false,
  publish_without_approval:false
})) {
  if (effects[k] !== v) errors.push('AUTHORITY:'+k);
}

const result = {
  schema: 'dreamledger/economic-north-star-proof/v1',
  status: errors.length ? 'FAIL' : 'PASS',
  checked_at: new Date().toISOString(),
  errors
};

fs.writeFileSync(
  path.join(root, 'PROOF-ECONOMIC-NORTH-STAR.json'),
  JSON.stringify(result, null, 2) + '\n',
  'utf8'
);
console.log(JSON.stringify(result, null, 2));
process.exit(errors.length ? 1 : 0);
