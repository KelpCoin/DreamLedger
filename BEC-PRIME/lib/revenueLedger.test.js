'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dreamledger-revenue-qr-'));
process.env.LEDGER_DATA_DIR = root;
const ledger = require('./revenueLedger');
const outboxPath = path.join(root, 'fulfillment-qr-outbox.jsonl');

test('every central fulfillment prepares the canonical QR and an idempotent outbox item', () => {
  const input = {
    transactionId: 'cs_test_qr_fixture',
    productId: 'TEST-SKU-001',
    offerId: 'TEST-OFFER-001',
    silo: 'mtg',
    amountMinor: 2900,
    currency: 'NZD',
    customerEmail: 'fixture@example.invalid'
  };
  const first = ledger.createFulfillment(input);
  assert.equal(first.created, true);
  assert.equal(first.fulfillment.customer_referral_qr.asset_id, 'QR-CANONICAL-001');
  assert.equal(first.fulfillment.customer_referral_qr.canonical_url, 'https://dreamledger.org/go?src=qr-canonical');
  assert.equal(first.fulfillment.customer_referral_qr.product_id, 'TEST-SKU-001');
  assert.ok(first.fulfillment.customer_referral_qr_html.includes('qr-canonical.svg'));
  assert.ok(first.fulfillment.customer_referral_qr_printable_html.includes('window.print()'));
  assert.equal(first.fulfillment.fulfillment_insert_url, 'https://dreamledger.org/qr/fulfillment-insert.html');
  assert.equal(fs.existsSync(outboxPath), true);
  const rowsAfterFirst = fs.readFileSync(outboxPath, 'utf8').trim().split(/\r?\n/).map(JSON.parse);
  assert.equal(rowsAfterFirst.length, 1);
  assert.equal(rowsAfterFirst[0].status, 'QR_ARTIFACT_PREPARED_NOT_ATTACHED');
  assert.ok(rowsAfterFirst[0].customer_referral_qr_html.includes('qr-canonical.svg'));
  assert.ok(rowsAfterFirst[0].customer_referral_qr_printable_html.includes('window.print()'));
  assert.match(rowsAfterFirst[0].truth_note, /does not prove/i);

  const second = ledger.createFulfillment(input);
  assert.equal(second.created, false);
  assert.equal(second.fulfillment.customer_referral_qr.asset_id, 'QR-CANONICAL-001');
  const rowsAfterRetry = fs.readFileSync(outboxPath, 'utf8').trim().split(/\r?\n/).map(JSON.parse);
  assert.equal(rowsAfterRetry.length, 1);
});
