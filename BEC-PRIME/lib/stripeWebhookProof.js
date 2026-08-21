/**
 * Stripe webhook -> durable transaction proof + accounting tag.
 * Payment evidence remains fail-closed: only a paid checkout.session.completed
 * can create a transaction proof or FIRST_PAYMENT_PROOF.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const taxLedger = require('./taxLedger');

function resolveDirs(env = process.env) {
  const ledger = path.resolve(env.LEDGER_DATA_DIR || path.join(__dirname, '..', 'data', 'transactions'));
  const proofs = path.resolve(env.PROOF_DATA_DIR || path.join(__dirname, '..', 'data', 'proofs'));
  const firstProof = path.resolve(env.FIRST_PAYMENT_PROOF_PATH || path.join(proofs, 'FIRST_PAYMENT_PROOF.json'));
  fs.mkdirSync(ledger, { recursive: true });
  fs.mkdirSync(proofs, { recursive: true });
  return { ledger, proofs, firstProof };
}

function verifyStripeSignature(rawBody, signatureHeader, webhookSecret) {
  if (!webhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
  if (!signatureHeader) throw new Error('Missing Stripe-Signature header');
  const parts = Object.fromEntries(String(signatureHeader).split(',').map(x => {
    const i = x.indexOf('='); return i === -1 ? [x, ''] : [x.slice(0, i), x.slice(i + 1)];
  }));
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) throw new Error('Invalid Stripe signature header');
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) throw new Error('Expired Stripe signature');
  const expected = crypto.createHmac('sha256', webhookSecret).update(`${timestamp}.${rawBody}`, 'utf8').digest('hex');
  const a = Buffer.from(expected, 'utf8'); const b = Buffer.from(signature, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new Error('Invalid Stripe signature');
}

function buildRecords(session, lookups = {}) {
  const paymentLinkId = session.payment_link || null;
  const resolvedProductId = session.metadata?.product_id || (paymentLinkId && lookups.getProductByPaymentLink ? lookups.getProductByPaymentLink(paymentLinkId) : null);
  const productId = resolvedProductId || null;
  const offerId = session.metadata?.offer_id || null;
  const capabilityId = session.metadata?.capability_id || null;
  const pricingTier = session.metadata?.pricing_tier || null;
  const product = productId && lookups.getProduct ? lookups.getProduct(productId) : null;
  const offer = offerId && lookups.getOffer ? lookups.getOffer(offerId) : null;
  if (!product && !offer) { const err = new Error('Unknown product or offer in session metadata/payment link'); err.code = 'UNKNOWN_COMMERCIAL_OBJECT'; throw err; }
  const silo = product?.silo || offer?.silo || session.metadata?.silo || null;
  const recordedAt = new Date().toISOString();
  const transactionId = session.id;
  const taxTag = taxLedger.buildTaxTag({ amountTotalMinor: session.amount_total, currency: session.currency, productId: product?.id || offer?.offer_id || null, silo });
  const tx = {
    transaction_id: transactionId, product_id: product?.id || null, offer_id: offer?.offer_id || null,
    capability_id: capabilityId || offer?.capability_id || null, pricing_tier: pricingTier || offer?.pricing_tier || null,
    payment_link_id: paymentLinkId, silo, amount_total: session.amount_total, currency: session.currency, payment_status: session.payment_status,
    customer_email: session.customer_details?.email || null, stripe_payment_intent: session.payment_intent || null,
    created_at: recordedAt, tax_tag: taxTag
  };
  const proof = {
    type: 'dreamledger-transaction-proof', status: 'PASS', transaction_id: transactionId,
    product_id: tx.product_id, offer_id: tx.offer_id, capability_id: tx.capability_id, pricing_tier: tx.pricing_tier,
    payment_link_id: paymentLinkId, silo: tx.silo, amount_total: tx.amount_total, currency: tx.currency, payment_status: tx.payment_status,
    payment_received: true, proof_source: 'stripe.checkout.session.completed.webhook', delivery_status: 'PENDING',
    customer_email: tx.customer_email, recorded_at: recordedAt, tax_tag: taxTag
  };
  return { tx, proof, transactionId, taxTag };
}

function writeProofArtifacts({ tx, proof, transactionId, taxTag }, dirs = resolveDirs()) {
  const txFile = path.join(dirs.ledger, `${transactionId}.json`);
  const proofFile = path.join(dirs.proofs, `${transactionId}.json`);
  if (fs.existsSync(txFile)) return { ok: true, idempotent: true, transaction_id: transactionId, first_payment_proof_written: false };
  fs.writeFileSync(txFile, JSON.stringify(tx, null, 2) + '\n', { flag: 'wx' });
  fs.writeFileSync(proofFile, JSON.stringify(proof, null, 2) + '\n', { flag: 'wx' });
  let firstWritten = false;
  if (!fs.existsSync(dirs.firstProof)) {
    try { fs.writeFileSync(dirs.firstProof, JSON.stringify(proof, null, 2) + '\n', { flag: 'wx' }); firstWritten = true; }
    catch (e) { if (e.code !== 'EEXIST') throw e; }
  }
  const taxResult = taxLedger.appendTaxLedger({
    date: new Date().toISOString(), transaction_id: transactionId,
    amount_nzd: Number(tx.amount_total || 0) / 100, gst: Number(taxTag.gst_amount_minor || 0) / 100,
    asset_id: tx.product_id || tx.offer_id || '', tax_tag: taxTag
  });
  return { ok: true, idempotent: false, transaction_id: transactionId, first_payment_proof_written: firstWritten,
    ledger_path: txFile, proof_path: proofFile, first_payment_proof_path: dirs.firstProof, tax_ledger: taxResult };
}

function handleStripeWebhook(rawBody, signatureHeader, opts) {
  const { webhookSecret, getProduct, getProductByPaymentLink, getOffer, dirs } = opts;
  verifyStripeSignature(rawBody, signatureHeader, webhookSecret);
  let event; try { event = JSON.parse(rawBody); } catch { const err = new Error('Invalid JSON payload'); err.statusCode = 400; throw err; }
  if (event.type !== 'checkout.session.completed') return { received: true, handled: false, type: event.type };
  const session = event.data.object;
  if (session.payment_status !== 'paid') return { received: true, handled: false, type: event.type, reason: 'payment_status_not_paid', payment_status: session.payment_status };
  const records = buildRecords(session, { getProduct, getProductByPaymentLink, getOffer });
  return { received: true, handled: true, fulfilled: true, ...writeProofArtifacts(records, dirs || resolveDirs()) };
}

module.exports = { resolveDirs, verifyStripeSignature, buildRecords, writeProofArtifacts, handleStripeWebhook };
