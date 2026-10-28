'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dreamledger-mtg-review-'));
process.env.DREAMIEZ_DATA_DIR = dir;
process.env.MTG_MARKETPLACE_REVIEW_TOKEN = 'test-only-review-token-0123456789abcdef01234567';
const { handle } = require('./mtgMarketplace');

function put(name, data) {
  fs.writeFileSync(path.join(dir, name), JSON.stringify(data), 'utf8');
}
async function invoke(method, route, data, user, token) {
  const req = Readable.from(data === undefined ? [] : [JSON.stringify(data)]);
  req.method = method;
  req.url = route;
  req.headers = {};
  if (user) req.headers.cookie = 'dreamiez_session=' + encodeURIComponent(user);
  if (token) req.headers['x-mtg-review-token'] = token;
  const res = {
    writableEnded: false, status: 0, content: '',
    writeHead(status) { this.status = status; },
    end(data) { this.content = String(data || ''); this.writableEnded = true; }
  };
  assert.equal(await handle(req, res, route), true);
  return { status: res.status, body: JSON.parse(res.content) };
}

test('private intake, reviewer gate, positive stock and direct-contract reservation', async () => {
  put('users.json', [
    { id: 'seller', email: 'seller@example.invalid', name: 'Seller', seller: { display_name: 'Test seller' } },
    { id: 'buyer', email: 'buyer@example.invalid', name: 'Buyer' }
  ]);
  // Existing records are not grandfathered into the public catalogue.
  put('mtg-marketplace-listings.json', [{
    id: 'legacy', status: 'active', seller_id: 'seller', title: 'Unreviewed legacy',
    quantity: 9, publication_permission: true
  }]);
  const token = process.env.MTG_MARKETPLACE_REVIEW_TOKEN;
  let r = await invoke('GET', '/api/mtg/marketplace/listings');
  assert.equal(r.status, 200);
  assert.equal(r.body.listings.length, 0);

  r = await invoke('POST', '/api/mtg/marketplace/list', {
    title: 'Test card', set_name: 'Test set', collector_number: '123',
    condition: 'Near Mint', language: 'English', quantity: 1,
    price_nzd: 12.5, accepts_buy: true, accepts_trade: false,
    trader_status: 'private', contact_address: 'Private address',
    publication_permission: true
  }, 'seller');
  assert.equal(r.status, 201);
  assert.equal(r.body.economic_state, 'UNPUBLISHED_PENDING_REVIEW');
  const id = r.body.listing.id;
  assert.equal(r.body.listing.status, 'pending_review');
  assert.equal(r.body.listing.seller_compliance, undefined);

  r = await invoke('GET', '/api/mtg/marketplace/listings', undefined, 'seller');
  assert.equal(r.body.listings.length, 0);
  assert.equal(r.body.mine.length, 2);
  assert.equal(r.body.mine[1].id, id);

  r = await invoke('POST', '/api/mtg/marketplace/review',
    { listing_id: id, decision: 'approve', physical_verified: true });
  assert.equal(r.status, 403);
  r = await invoke('POST', '/api/mtg/marketplace/review',
    { listing_id: id, decision: 'approve', physical_verified: false }, null, token);
  assert.equal(r.status, 422);
  r = await invoke('POST', '/api/mtg/marketplace/review',
    { listing_id: id, decision: 'approve', physical_verified: true }, null, token);
  assert.equal(r.status, 200);
  assert.equal(r.body.economic_state, 'APPROVED_LISTING_NOT_A_SALE');

  r = await invoke('GET', '/api/mtg/marketplace/listings');
  assert.equal(r.body.listings.length, 1);
  assert.equal(r.body.listings[0].id, id);
  assert.equal(r.body.listings[0].seller_compliance, undefined);
  assert.equal(JSON.stringify(r.body).includes('Private address'), false);

  r = await invoke('POST', '/api/mtg/marketplace/request',
    { listing_id: id, type: 'buy', offered_amount_nzd: 12.5 }, 'buyer');
  assert.equal(r.status, 201);
  assert.equal(r.body.economic_state, 'UNSETTLED_REQUEST');
  const requestId = r.body.request.id;

  r = await invoke('POST', '/api/mtg/marketplace/request/decision',
    { request_id: requestId, decision: 'accept' }, 'seller');
  assert.equal(r.status, 200);
  assert.equal(r.body.request.status, 'accepted_direct_contract_pending_settlement');

  r = await invoke('GET', '/api/mtg/marketplace/listings');
  assert.equal(r.body.listings.length, 0, 'reserved listing must leave public feed');
  r = await invoke('POST', '/api/mtg/marketplace/request',
    { listing_id: id, type: 'buy' }, 'buyer');
  assert.equal(r.status, 404);
  const stored = JSON.parse(fs.readFileSync(path.join(dir, 'mtg-marketplace-listings.json')));
  assert.equal(stored.find(x => x.id === id).status, 'reserved');
  assert.equal(stored.find(x => x.id === 'legacy').status, 'active');
});

test('reject bad quantity, consent-less listing and incomplete printing remain private', async () => {
  let r = await invoke('POST', '/api/mtg/marketplace/list', {
    title: 'Bad stock', quantity: -1, accepts_buy: true, price_nzd: 10,
    trader_status: 'private', contact_address: 'Private address'
  }, 'seller');
  assert.equal(r.status, 422);
  r = await invoke('POST', '/api/mtg/marketplace/list', {
    title: 'Ambiguous card', quantity: 1, accepts_buy: true, price_nzd: 10,
    trader_status: 'private', contact_address: 'Private address'
  }, 'seller');
  assert.equal(r.status, 201);
  const id = r.body.listing.id;
  r = await invoke('POST', '/api/mtg/marketplace/review',
    { listing_id: id, decision: 'approve', physical_verified: true }, null, process.env.MTG_MARKETPLACE_REVIEW_TOKEN);
  assert.equal(r.status, 422);
  r = await invoke('GET', '/api/mtg/marketplace/listings');
  assert.equal(r.body.listings.length, 0);
});

test.after(() => fs.rmSync(dir, { recursive: true, force: true }));
