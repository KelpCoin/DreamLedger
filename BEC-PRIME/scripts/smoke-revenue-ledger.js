'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const proofRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dreamledger-ledger-smoke-'));
process.env.LEDGER_DATA_DIR = path.join(proofRoot, 'ledger');
const ledger = require('../lib/revenueLedger');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const eventId = 'evt_smoke_revenue_001';
const transactionId = 'cs_smoke_revenue_001';
const payment = ledger.recordPayment({
  eventId,
  transactionId,
  amountMinor: 1500,
  currency: 'nzd',
  productId: 'COMMANDER-DECK-DIAGNOSTIC-001',
  silo: 'mtg'
});
assert(payment.duplicate === false, 'First payment event should be recorded');
const duplicate = ledger.recordPayment({
  eventId,
  transactionId,
  amountMinor: 1500,
  currency: 'nzd',
  productId: 'COMMANDER-DECK-DIAGNOSTIC-001',
  silo: 'mtg'
});
assert(duplicate.duplicate === true, 'Duplicate Stripe event must be idempotent');
const fulfillment = ledger.createFulfillment({
  transactionId,
  productId: 'COMMANDER-DECK-DIAGNOSTIC-001',
  silo: 'mtg',
  amountMinor: 1500,
  currency: 'nzd',
  customerEmail: 'smoke@example.invalid'
});
assert(fulfillment.fulfillment.status === 'READY_FOR_DELIVERY', 'Fulfillment fossil not created');
const revenue = ledger.recordFulfillment({
  eventId: `${eventId}:fulfillment`,
  transactionId,
  fulfillmentId: fulfillment.fulfillment.fulfillment_id,
  amountMinor: 1500,
  currency: 'nzd',
  productId: 'COMMANDER-DECK-DIAGNOSTIC-001',
  silo: 'mtg'
});
assert(revenue.duplicate === false, 'Revenue recognition event should be recorded');
const duplicateRevenue = ledger.recordFulfillment({
  eventId: `${eventId}:fulfillment`,
  transactionId,
  fulfillmentId: fulfillment.fulfillment.fulfillment_id,
  amountMinor: 1500,
  currency: 'nzd',
  productId: 'COMMANDER-DECK-DIAGNOSTIC-001',
  silo: 'mtg'
});
assert(duplicateRevenue.duplicate === true, 'Duplicate fulfillment event must be idempotent');
const health = ledger.health();
assert(health.balanced === true, 'Double-entry ledger is not balanced');
assert(health.journal_count === 2, 'Expected payment and revenue journals');
assert(health.ledger_entry_count === 4, 'Expected four double-entry ledger lines');
const proof = {
  schema: 'BEC-PRIME/REVENUE-LEDGER-SMOKE/v1',
  status: 'PASS',
  verified_at: new Date().toISOString(),
  event_id: eventId,
  transaction_id: transactionId,
  idempotency: { payment_duplicate_blocked: duplicate.duplicate, fulfillment_duplicate_blocked: duplicateRevenue.duplicate },
  ledger: health,
  proof_root: proofRoot
};
fs.writeFileSync(path.join(proofRoot, 'PROOF-REVENUE-LEDGER.json'), JSON.stringify(proof, null, 2) + '\n');
console.log(JSON.stringify(proof, null, 2));
