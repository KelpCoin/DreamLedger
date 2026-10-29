'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'config/tenants/nz-mtg.master.json');
const raw = fs.readFileSync(source);
const m = JSON.parse(raw.toString('utf8'));
assert.equal(m.schema, 'beck/tenant-master-manifest/v1');
assert.equal(m.master_silo, 'nz-mtg');
assert.equal(m.clone.enabled, false);
assert.equal(m.clone.batch_enabled, false);
assert.equal(m.evidence.clone_gate, 'HOLD');
assert.equal(m.evidence.verified_external_sale, false);
assert.equal(m.commerce.edh_0001.checkout_status, 'HELD_PRICE_CONFLICT');
assert.equal(m.commerce.payout_credentials, 'NOT_IN_MANIFEST');
assert.equal(m.silo_boundaries.adult_silo_cross_reference, 'FORBIDDEN');
for (const phase of ['phase1','phase2','phase3','phase4']) assert.equal(m.evidence[phase], 'HOLD');
const proof = {
  schema: 'beck/master-manifest-proof/v1',
  manifest: 'config/tenants/nz-mtg.master.json',
  manifest_sha256: crypto.createHash('sha256').update(raw).digest('hex'),
  result: 'PASS_FAIL_CLOSED_MANIFEST',
  clone_gate: 'HOLD',
  generated_at: new Date().toISOString()
};
fs.writeFileSync(path.join(root, 'beck-master-manifest-proof.json'), JSON.stringify(proof, null, 2) + '\n');
console.log(JSON.stringify(proof, null, 2));
