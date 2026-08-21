/**
 * Offline self-test for stripeWebhookProof (no network, no Stripe).
 * Usage: node BEC-PRIME/scripts/test-stripe-webhook-proof.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const {
  resolveDirs,
  verifyStripeSignature,
  buildRecords,
  writeProofArtifacts,
  handleStripeWebhook,
} = require('../lib/stripeWebhookProof');

const SECRET = 'whsec_test_dreamledger_offline';
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dl-webhook-'));
const dirs = {
  ledger: path.join(tmpRoot, 'ledger'),
  proofs: path.join(tmpRoot, 'proofs'),
  firstProof: path.join(tmpRoot, 'proofs', 'FIRST_PAYMENT_PROOF.json'),
};
fs.mkdirSync(dirs.ledger, { recursive: true });
fs.mkdirSync(dirs.proofs, { recursive: true });

function sign(raw) {
  const t = Math.floor(Date.now() / 1000);
  const v1 = crypto.createHmac('sha256', SECRET).update(`${t}.${raw}`, 'utf8').digest('hex');
  return `t=${t},v1=${v1}`;
}

const session = {
  id: 'cs_test_offline_001',
  object: 'checkout.session',
  payment_status: 'paid',
  amount_total: 4900,
  currency: 'nzd',
  payment_intent: 'pi_test_offline',
  customer_details: { email: 'test@example.com' },
  metadata: {
    offer_id: 'OFFER-BEC-PRIME-READINESS-AUDIT-SNAPSHOT',
    capability_id: 'BEC-PRIME-READINESS-AUDIT',
    silo: 'dreamledger',
    pricing_tier: 'snapshot',
  },
};

const event = {
  id: 'evt_test_offline',
  type: 'checkout.session.completed',
  data: { object: session },
};

const raw = JSON.stringify(event);
const header = sign(raw);

const offer = {
  offer_id: 'OFFER-BEC-PRIME-READINESS-AUDIT-SNAPSHOT',
  capability_id: 'BEC-PRIME-READINESS-AUDIT',
  silo: 'dreamledger',
  pricing_tier: 'snapshot',
};

verifyStripeSignature(raw, header, SECRET);

const records = buildRecords(session, {
  getOffer: (id) => (id === offer.offer_id ? offer : null),
});
const first = writeProofArtifacts(records, dirs);
if (!first.ok || first.idempotent || !first.first_payment_proof_written) {
  throw new Error('First write failed: ' + JSON.stringify(first));
}

const second = writeProofArtifacts(records, dirs);
if (!second.idempotent) throw new Error('Expected idempotent second write');

const handled = handleStripeWebhook(raw, header, {
  webhookSecret: SECRET,
  getOffer: (id) => (id === offer.offer_id ? offer : null),
  dirs,
});
if (!handled.received || !handled.handled) {
  throw new Error('Handler failed: ' + JSON.stringify(handled));
}

const firstProof = JSON.parse(fs.readFileSync(dirs.firstProof, 'utf8'));
if (firstProof.status !== 'PASS' || firstProof.offer_id !== offer.offer_id) {
  throw new Error('FIRST_PAYMENT_PROOF content invalid');
}

const paymentLinkSession = {
  id: 'cs_test_payment_link_001',
  object: 'checkout.session',
  payment_status: 'paid',
  amount_total: 2900,
  currency: 'nzd',
  payment_link: 'plink_test_architecture_audit',
  payment_intent: 'pi_test_payment_link',
  customer_details: { email: 'payment-link@example.com' },
  metadata: {},
};
const paymentLinkRecords = buildRecords(paymentLinkSession, {
  getProductByPaymentLink: (id) => id === 'plink_test_architecture_audit' ? 'BEC-PRIME-ARCHITECTURE-AUDIT-001' : null,
  getProduct: (id) => id === 'BEC-PRIME-ARCHITECTURE-AUDIT-001' ? {
    id,
    silo: 'commerce',
    name: 'Agentic Sovereignty Diagnostic',
  } : null,
});
if (paymentLinkRecords.tx.product_id !== 'BEC-PRIME-ARCHITECTURE-AUDIT-001') {
  throw new Error('Payment-link product resolution failed');
}
if (paymentLinkRecords.proof.payment_link_id !== 'plink_test_architecture_audit') {
  throw new Error('Payment-link identity missing from proof');
}

console.log(
  JSON.stringify(
    {
      status: 'PASS',
      module: 'stripeWebhookProof',
      first_payment_proof_written: first.first_payment_proof_written,
      idempotent_reentry: second.idempotent,
      transaction_id: first.transaction_id,
      payment_link_resolution: 'PASS',
      payment_link_product_id: paymentLinkRecords.tx.product_id,
      tmp: tmpRoot,
    },
    null,
    2
  )
);
