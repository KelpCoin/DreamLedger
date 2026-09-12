'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'dreamledger-synthetic-'));
process.env.BEC_LEDGER_DIR = path.join(TMP, 'bec-ledger');
process.env.LEDGER_DATA_DIR = path.join(TMP, 'revenue-ledger');
process.env.BILLBOARD_DATA_DIR = path.join(TMP, 'billboard');
process.env.PROOF_DATA_DIR = path.join(TMP, 'proofs');
process.env.PUBLIC_BASE_URL = 'http://synthetic.local';
process.env.STRIPE_WEBHOOK_SECRET = 'synthetic_webhook_secret';

const distributionDoorway = require('../routes/distributionDoorway');
const platformCart = require('../routes/platformCart');
const revenueLedger = require('../lib/revenueLedger');

function mockResponse() {
  return {
    headers: {}, statusCode: null, body: '', writableEnded: false,
    setHeader(name, value) { this.headers[name] = value; },
    writeHead(status, headers) { this.statusCode = status; Object.assign(this.headers, headers || {}); },
    end(body = '') { this.body = body; this.writableEnded = true; }
  };
}
function req(url, headers = {}) { return { method: 'GET', url, headers, socket: { remoteAddress: '198.51.100.7' } }; }
function signed(raw) { const timestamp = Math.floor(Date.now() / 1000); const digest = crypto.createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET).update(`${timestamp}.${raw}`, 'utf8').digest('hex'); return `t=${timestamp},v1=${digest}`; }
function writeSyntheticBillboard() {
  const file = path.join(process.env.BILLBOARD_DATA_DIR, 'markets', 'NZ', 'billboard.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ version: 2, market: 'NZ', canvas: { w: 1000, h: 1000 }, ads: [{
    id: 'synthetic_ad_0001', market: 'NZ', sku: 'BILLBOARD-SMALL', status: 'AWAITING_PAYMENT', size: 'small', size_label: 'Founding Tile', w: 100, h: 100, x: 0, y: 0,
    title: 'Synthetic Commerce Test', name: 'Synthetic Buyer', email: 'synthetic@example.invalid', link: 'https://example.invalid/synthetic', mime: 'image/png', ext: '.png', image_filename: 'synthetic.png', created_at: new Date().toISOString(), automated_validation: 'PASS', payment_status: 'unpaid', payment_recorded: false, fulfillment_recorded: false
  }] }, null, 2) + '\n', 'utf8');
}

async function main() {
  const doorwayRes = mockResponse();
  const doorwayHandled = await distributionDoorway.handle(req('/go?utm_source=synthetic&campaign=SYNTHETIC-001&offer=OFFER-DREAMLEDGER-BILLBOARD-FOUNDING-001'), doorwayRes);
  assert.equal(doorwayHandled, true, 'canonical /go should handle GET');
  assert.equal(doorwayRes.statusCode, 302, 'canonical /go should redirect');
  assert.match(String(doorwayRes.headers.Location), /^\/billboard\?/);
  assert.ok(doorwayRes.headers['X-BEC-Doorway-Event'], 'doorway event id should be emitted');

  const checkout = await platformCart.createProductCheckout('DREAMLEDGER-BILLBOARD-FOUNDING-001', 'dreamledger');
  assert.equal(checkout.ok, true);
  assert.equal(checkout.mode, 'canonical_payment_link');
  assert.equal(checkout.amount_minor, 5000);
  assert.equal(checkout.currency, 'nzd');
  assert.equal(checkout.payment_link_id, 'plink_1UCrekEGgEAnUFF9XVRM04aG');

  writeSyntheticBillboard();
  const event = { id: 'evt_synthetic_0001', type: 'checkout.session.completed', data: { object: {
    id: 'cs_synthetic_0001', payment_status: 'paid', amount_total: 5000, currency: 'nzd', metadata: { product: 'DREAMLEDGER-BILLBOARD', ad_id: 'synthetic_ad_0001' }
  } } };
  const raw = JSON.stringify(event);
  const webhookReq = { method: 'POST', url: '/webhook', headers: { 'stripe-signature': signed(raw) } };
  const webhookRes = mockResponse();
  const first = await platformCart.handleWebhook({ ...webhookReq, async *[Symbol.asyncIterator]() { yield raw; } }, webhookRes);
  assert.equal(first.handled, true, 'signed synthetic paid webhook should be handled');

  const ad = JSON.parse(fs.readFileSync(path.join(process.env.BILLBOARD_DATA_DIR, 'markets', 'NZ', 'billboard.json'), 'utf8')).ads[0];
  assert.equal(ad.payment_status, 'paid'); assert.equal(ad.payment_recorded, true); assert.equal(ad.fulfillment_recorded, true); assert.equal(ad.status, 'PUBLISHED');
  const before = revenueLedger.health();
  assert.equal(before.event_count, 2, 'synthetic payment + fulfillment should produce two revenue events'); assert.equal(before.fulfillment_count, 1); assert.equal(before.balanced, true);
  const duplicateRes = mockResponse();
  await platformCart.handleWebhook({ ...webhookReq, async *[Symbol.asyncIterator]() { yield raw; } }, duplicateRes);
  const after = revenueLedger.health();
  assert.equal(after.event_count, before.event_count, 'duplicate webhook must not create another revenue event'); assert.equal(after.fulfillment_count, before.fulfillment_count, 'duplicate webhook must not create another fulfillment'); assert.equal(after.balanced, true);

  console.log(JSON.stringify({ schema: 'BEC-SYNTHETIC-COMMERCE-PATH/v1', status: 'PASS', mode: 'SYNTHETIC', economic_claim: false, revenue_claim: false, ra000001_claim: false, path: ['QR_CANONICAL','GET /go','DOORWAY_VISIT','CANONICAL_OFFER','CHECKOUT_SURFACE','SYNTHETIC_STRIPE_WEBHOOK','PAYMENT_EVENT','FULFILLMENT_EVENT','DURABLE_LEDGER_BALANCE'], doorway_event_id: doorwayRes.headers['X-BEC-Doorway-Event'], checkout_mode: checkout.mode, synthetic_transaction_id: 'cs_synthetic_0001', ledger: after, checked_at: new Date().toISOString() }, null, 2));
}
main().catch(err => { console.error(JSON.stringify({ schema: 'BEC-SYNTHETIC-COMMERCE-PATH/v1', status: 'FAIL', mode: 'SYNTHETIC', error: err.message, stack: err.stack }, null, 2)); process.exitCode = 1; });

// Trigger BEC Runtime Proof execution without changing test behavior.
