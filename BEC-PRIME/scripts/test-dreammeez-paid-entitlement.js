'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dreammeez-entitlement-'));
process.env.DREAMIEZ_DATA_DIR = tmp;

fs.writeFileSync(path.join(tmp, 'users.json'), JSON.stringify([
  { id: 'u_test', email: 'buyer@example.com', email_verified: true, cosmetics: [] }
], null, 2));
fs.writeFileSync(path.join(tmp, 'cosmetics.json'), JSON.stringify([
  { id: 'cosmic-hoodie', name: 'Cosmic Hoodie', product_id: 'COSMIC-HOODIE' },
  { id: 'cape', name: 'Cape', product_id: 'CAPE' },
  { id: 'chrome-boots', name: 'Chrome Boots', product_id: 'CHROME-BOOTS' }
], null, 2));

const entitlement = require('../lib/dreammeezPaidEntitlement');

const session = { customer_details: { email: 'buyer@example.com' } };
const first = entitlement.grantPaidCosmetic({
  eventId: 'evt_test_1',
  transactionId: 'cs_test_1',
  session,
  sku: 'COSMIC-HOODIE'
});
assert.strictEqual(first.status, 'GRANTED');
assert.strictEqual(first.account_id, 'u_test');
assert.strictEqual(first.cosmetic_id, 'cosmic-hoodie');

const duplicate = entitlement.grantPaidCosmetic({
  eventId: 'evt_test_1',
  transactionId: 'cs_test_1',
  session,
  sku: 'COSMIC-HOODIE'
});
assert.strictEqual(duplicate.idempotent, true);

const users = JSON.parse(fs.readFileSync(path.join(tmp, 'users.json'), 'utf8'));
assert.deepStrictEqual(users[0].cosmetics, ['cosmic-hoodie']);

const pending = entitlement.grantPaidCosmetic({
  eventId: 'evt_test_2',
  transactionId: 'cs_test_2',
  session: { customer_details: { email: 'newbuyer@example.com' } },
  sku: 'CAPE'
});
assert.strictEqual(pending.status, 'PENDING_ACCOUNT');

console.log(JSON.stringify({ ok: true, granted: first.entitlement_id, idempotent: duplicate.entitlement_id, pending: pending.entitlement_id }));
