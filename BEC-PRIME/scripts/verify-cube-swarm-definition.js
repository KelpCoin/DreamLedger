'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const FILE = path.join(ROOT, 'ops', 'cube-swarm', 'silo-definitions', 'mtg-commander.json');
const d = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const errors = [];
const required = (condition, message) => { if (!condition) errors.push(message); };

required(d.schema_version === 'dreamledger/cube-swarm-silo-definition/v1', 'schema_version is invalid');
required(d.silo_id === 'mtg-commander', 'unexpected silo_id');
required(d.lifecycle === 'CANDIDATE', 'first silo must remain CANDIDATE until commercial proof exists');
required(d.commercial_contract?.sku === 'COMMANDER-DECK-DIAGNOSTIC-001', 'canonical SKU missing');
required(d.commercial_contract?.legacy_sku === 'CMD-DIAG-29', 'legacy SKU mapping missing');
required(d.commercial_contract?.currency === 'NZD' && d.commercial_contract?.amount_minor === 2900, 'price contract must be NZD 29.00');
required(d.commercial_contract?.checkout_status === 'UNVERIFIED_MISMATCH', 'checkout mismatch must remain explicit until live Stripe verification');
required(d.isolation?.database_strategy === 'DEDICATED_D1_PER_SILO', 'database isolation strategy missing');
required(d.isolation?.cross_silo_customer_data === false, 'cross-silo customer data must be disabled');
required(d.provisioning?.mode === 'DRY_RUN_ONLY' && d.provisioning?.deploy_allowed === false, 'provisioning must fail closed before verification');
required(d.isolation?.database_id === null, 'do not invent a D1 database ID');
required(Array.isArray(d.routes) && d.routes.includes('/api/commercial/input'), 'fulfillment input route missing');
required(Array.isArray(d.commercial_contract?.evidence_required) && d.commercial_contract.evidence_required.includes('report_artifact_sha256'), 'artifact evidence gate missing');

if (errors.length) {
  console.error('FAIL Cube Swarm definition validation');
  for (const e of errors) console.error('- ' + e);
  process.exit(1);
}
console.log('PASS Cube Swarm definition is structurally valid.');
console.log('BLOCKED by design: provisioning/deployment is disabled until checkout and fulfillment are verified.');
