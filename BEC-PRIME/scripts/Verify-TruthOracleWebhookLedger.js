'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dreamledger-truth-oracle-'));
process.env.LEDGER_DATA_DIR = path.join(root, 'ledger');
process.env.BEC_LEDGER_DIR = process.env.LEDGER_DATA_DIR;
process.env.PROOF_DATA_DIR = path.join(root, 'proofs');

// Deterministic fixture bootstrap: the runtime ledger creates EVENTS.jsonl on first append.
// Seed an empty ledger file so this verifier never mistakes a missing fixture for a failed read.
fs.mkdirSync(process.env.LEDGER_DATA_DIR, { recursive: true });
const eventsPath = path.join(process.env.LEDGER_DATA_DIR, 'EVENTS.jsonl');
if (!fs.existsSync(eventsPath)) fs.writeFileSync(eventsPath, '', 'utf8');

const stripeWebhookProof = require('../lib/stripeWebhookProof');

const secret = 'whsec_verify_truth_oracle';
const event = {
  id: 'evt_truth_oracle_verification_001',
  type: 'checkout.session.completed',
  livemode: false,
  created: Math.floor(Date.now() / 1000),
  data: { object: {
    id: 'cs_truth_oracle_verification_001',
    mode: 'subscription',
    payment_status: 'paid',
    client_reference_id: 'verification-user-001',
    amount_total: 499,
    currency: 'nzd',
    metadata: {
      silo: 'truth-oracle',
      user_id: 'verification-user-001',
      truth_oracle_tier: 'SIGNAL'
    }
  }}
};
const raw = JSON.stringify(event);
const timestamp = Math.floor(Date.now() / 1000);
const signature = crypto.createHmac('sha256', secret).update(`${timestamp}.${raw}`, 'utf8').digest('hex');
const header = `t=${timestamp},v1=${signature}`;

stripeWebhookProof.verifyStripeSignature(raw, header, secret);
stripeWebhookProof.verifyStripeSignature(raw, header, secret);

const eventsRaw = fs.readFileSync(eventsPath, 'utf8').trim();
const events = eventsRaw ? JSON.parse('[' + eventsRaw.split(/\r?\n/).join(',') + ']') : [];
const fixtureLock = { file: 'EVENTS.jsonl', line_count: eventsRaw ? eventsRaw.split(/\r?\n/).length : 0, sha256: crypto.createHash('sha256').update(eventsRaw, 'utf8').digest('hex') };
fs.writeFileSync(path.join(root, 'fixture-lock.json'), JSON.stringify(fixtureLock, null, 2) + '\n');
assert.strictEqual(events.length, 1, 'duplicate Stripe event must produce one ledger event');
assert.strictEqual(events[0].event_id, 'stripe_evt_truth_oracle_verification_001');
assert.strictEqual(events[0].claims.payment_claim, true);
assert.strictEqual(events[0].claims.sale_claim, true);
assert.strictEqual(fs.existsSync(path.join(process.env.PROOF_DATA_DIR, 'truth-oracle', 'evt_truth_oracle_verification_001.json')), true);
assert.strictEqual(stripeWebhookProof.verifyStripeSignature(raw, header, secret).id, event.id);

let rejected = false;
try {
  stripeWebhookProof.verifyStripeSignature(raw, `t=${timestamp},v1=bad`, secret);
} catch { rejected = true; }
assert.strictEqual(rejected, true, 'invalid signature must fail closed');

console.log(JSON.stringify({ status: 'PASS', ledger_events: events.length, event_id: events[0].event_id, proof_written: true, invalid_signature_rejected: rejected }, null, 2));
