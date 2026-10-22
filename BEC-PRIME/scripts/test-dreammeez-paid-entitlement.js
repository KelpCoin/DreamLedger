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

// A paid guest must not receive the cosmetic until the matching email account is verified.
// Verification must claim the pending record, and a subsequent account read must preserve it.
const http = require('http');
const dreamiez = require('../routes/dreamiez');
const testBuyerId = 'u_new_buyer';
const buyerUsers = JSON.parse(fs.readFileSync(path.join(tmp, 'users.json'), 'utf8'));
buyerUsers.push({
  id: testBuyerId, email: 'newbuyer@example.com', email_verified: false, cosmetics: [],
  streak: 1, lastVisit: new Date().toISOString().slice(0, 10),
  email_verification_token: 'test-redeem-token',
  email_verification_expires: new Date(Date.now() + 3600000).toISOString()
});
fs.writeFileSync(path.join(tmp, 'users.json'), JSON.stringify(buyerUsers));

(async () => {
  const server = http.createServer((req, res) => {
    Promise.resolve(dreamiez.handle(req, res, req.url.split('?')[0])).then(handled => {
      if (!handled && !res.writableEnded) { res.writeHead(404); res.end(); }
    }).catch(err => { if (!res.headersSent) res.writeHead(500); res.end(err.message); });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const origin = 'http://127.0.0.1:' + server.address().port;
    const cookie = { cookie: 'dreamiez_session=' + testBuyerId };
    const before = await fetch(origin + '/api/dreamiez/me', { headers: cookie });
    assert.strictEqual(before.status, 200);
    assert.deepStrictEqual((await before.json()).account.cosmetics, []);
    const verify = await fetch(origin + '/api/dreamiez/account/verify?token=test-redeem-token', { headers: cookie });
    assert.strictEqual(verify.status, 200);
    const verified = await verify.json();
    assert.strictEqual(verified.account.email_verified, true);
    assert.deepStrictEqual(verified.account.cosmetics, ['cape']);
    const after = await fetch(origin + '/api/dreamiez/me', { headers: cookie });
    assert.strictEqual(after.status, 200);
    assert.deepStrictEqual((await after.json()).account.cosmetics, ['cape']);
    const persisted = JSON.parse(fs.readFileSync(path.join(tmp, 'paid-entitlements.json'), 'utf8'));
    assert.strictEqual(persisted.find(x => x.transaction_id === 'cs_test_2').status, 'GRANTED');
    assert.strictEqual(persisted.filter(x => x.transaction_id === 'cs_test_2').length, 1);
    console.log(JSON.stringify({ ok: true, paid_guest_claimed_after_verification: true, idempotent_on_reload: true }));
  } finally {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(tmp, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
