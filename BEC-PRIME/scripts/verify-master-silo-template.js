'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const templatePath = path.join(__dirname, '..', 'catalog', 'marketplace', 'master-silo-template.v1.json');
const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));

assert.equal(template.schema, 'dreamledger.silo.master-template.v1');
assert.equal(template.reference_silo_id, 'mtg');
assert.equal(template.reference_silo_name, 'Magic: The Gathering');
assert.equal(template.clone_policy.clone_enabled, false, 'MTG clones must remain held until reference gates pass');
assert.equal(template.clone_policy.reuse_shared_kernel, true, 'clones must reuse the existing marketplace kernel');
assert.equal(template.clone_policy.copy_production_records, false, 'production records must not be copied');
assert.equal(template.clone_policy.copy_credentials_or_secrets, false, 'access material must not be copied');
assert.equal(template.clone_policy.copy_customer_or_supplier_data, false, 'customer and supplier records must not be copied');
assert.equal(template.clone_policy.copy_inventory_or_entitlements, false, 'inventory and entitlements must not be copied');
assert.equal(template.clone_policy.owner_approval_required, true);
assert.equal(template.economic_validation.status, 'NOT_ECONOMICALLY_VALIDATED');
assert.equal(template.economic_validation.verified_external_revenue_nzd, 0);
assert.equal(template.economic_validation.clone_authorized, false);

console.log(JSON.stringify({
  status: 'PASS_MTG_MASTER_SILO_TEMPLATE',
  reference_silo_id: template.reference_silo_id,
  clone_enabled: template.clone_policy.clone_enabled,
  verified_external_revenue_nzd: template.economic_validation.verified_external_revenue_nzd
}, null, 2));
