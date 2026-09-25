'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { buildRun } = require('./FactoryFactory');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'factory-factory', 'FACTORY-FACTORY-CYCLE.json');

function sha(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function run() {
  const started = Date.now();
  const result = buildRun({ limit: Number(process.env.FACTORY_FACTORY_BATCH || 16) });
  const cycle = {
    schema_version: 'DREAMLEDGER/FACTORY-FACTORY-CYCLE/v1',
    generated_at_utc: new Date().toISOString(),
    duration_ms: Date.now() - started,
    selected_count: result.selected_count,
    selected: result.selected,
    authority_boundary: result.authority_boundary,
    external_action: 'NOT_PERFORMED',
    external_revenue: 'UNVERIFIED',
    business_truth: 'NOT_CLAIMED',
    next_machine_action: result.next_machine_action
  };
  cycle.integrity_sha256 = sha(JSON.stringify(cycle));
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(cycle, null, 2) + '\n', 'utf8');
  return cycle;
}

if (require.main === module) {
  console.log(JSON.stringify(run(), null, 2));
}

module.exports = { run };
