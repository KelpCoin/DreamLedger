'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const templatePath = path.join(__dirname, '..', 'catalog', 'marketplace', 'master-silo-template.v1.json');
const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));

assert.equal(template.schema, 'dreamledger.silo.master-template.v1');
assert.equal(template.reference_silo_id, 'mtg');
assert.equal(template.reference_silo_name, 'Magic: The Gathering');
assert.equal(template.clone_enabled, false, 'MTG clones must remain held until reference gates pass');
assert.equal(template.reuse_existing_kernel, true, 'clones must reuse the existing marketplace kernel');
assert.equal(template.catalogue_and_inventory_are_silo_owned, true, 'catalogue and inventory must remain silo-owned');
assert.equal(template.copy_live_data_or_credentials, false, 'production records and access material must not be copied');
assert.equal(template.owner_approval_required, true);
assert.equal(template.economic_validation.status, 'NOT_ECONOMICALLY_VALIDATED');
assert.equal(template.economic_validation.verified_external_revenue_nzd, 0);
assert.equal(template.economic_validation.clone_authorized, false);

console.log(JSON.stringify({
  status: 'PASS_MTG_MASTER_SILO_TEMPLATE',
  reference_silo_id: template.reference_silo_id,
  clone_enabled: template.clone_enabled,
  verified_external_revenue_nzd: template.economic_validation.verified_external_revenue_nzd
}, null, 2));
