'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..', '..');
const proofDir = path.join(ROOT, 'BEC-PRIME', 'data', 'proofs');
fs.mkdirSync(proofDir, { recursive: true });

const checks = [];
function check(id, ok, detail) {
  checks.push({ id, status: ok ? 'PASS' : 'FAIL', detail });
  if (!ok) process.exitCode = 1;
}
function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

// Audit the served static pages, not retired home.html/mtg.html aliases.
const index = read('public/index.html');
const catalogText = read('public/catalog.json');
const catalog = JSON.parse(catalogText);
const mtg = read('public/mtg/index.html');
const truthPricing = JSON.parse(read('BEC-PRIME/catalog/truth-oracle/pricing.json'));
const approvedOffers = JSON.parse(read('BEC-PRIME/catalog/offers/approved.json'));
const heldDiagnosticOffer = (approvedOffers.held || []).find(x => x && x.offer_id === 'OFFER-CMD-DIAG-29-NZD');
const activeDiagnosticOffer = (approvedOffers.approved || []).find(x => x && x.offer_id === 'OFFER-CMD-DIAG-29-NZD');
const edh0001 = JSON.parse(read('BEC-PRIME/catalog/products/EDH_0001.json'));
const edh0001LegacyPrice = Number(edh0001.price) / (String(edh0001.price_unit).toLowerCase() === 'minor' ? 100 : 1);


check('homepage-canonical-doors',
  ['DreamLedger', 'Truth Oracle', 'Supplier quote worksheet'].every((x) => index.toLowerCase().includes(x.toLowerCase())) && !/Agent Delivery Proof Audit|agent-delivery-proof-audit/i.test(index),
  'Served homepage exposes the free evidence tools; the retired audit offer is absent.');
const diagnostic = Array.isArray(catalog.products)
  ? catalog.products.find((x) => x && x.id === 'COMMANDER-DECK-DIAGNOSTIC-001' && x.sku === 'CMD-DIAG-29')
  : null;
check('diagnostic-current-public-catalog',
  !!diagnostic && Number(diagnostic.price) === 29 && String(diagnostic.currency || '').toUpperCase() === 'NZD'
    && diagnostic.status === 'held' && diagnostic.checkout_available === false
    && Number(diagnostic.inventory) === 0 && !diagnostic.checkout_url
    && !diagnostic.payment_link_id && !diagnostic.stripe_price_id,
  'Commander Deck Diagnostic remains explicitly held, zero-inventory, and without a public checkout reference.');

check('diagnostic-removed-from-active-offers',
  !activeDiagnosticOffer && !!heldDiagnosticOffer
    && heldDiagnosticOffer.status === 'HELD_NOT_RELEASED'
    && heldDiagnosticOffer.checkout_available === false
    && heldDiagnosticOffer.payment_link_status !== 'ACTIVE_LIVEMODE'
    && !heldDiagnosticOffer.payment_link_url && !heldDiagnosticOffer.payment_link_id,
  'Commander Diagnostic is in the held registry, not the public/approved offer list; app-level live link references are removed.');
check('edh0001-price-conflict-fail-closed',
  edh0001.status === 'held' && Number(edh0001.inventory) === 0
    && edh0001.checkout.mode === 'disabled'
    && edh0001.commercial_truth.sellable === false
    && edh0001.commercial_truth.approval_required === true
    && !edh0001.payment_link && !edh0001.payment_link_id
    && edh0001LegacyPrice === 400,
  'EDH_0001 uses an NZ$400 legacy source amount but is held until reconciliation against the NZ$230 public catalog amount.');
check('diagnostic-not-marketed-on-public-home',
  !/Commander Deck Diagnostic|CMD-DIAG-29/i.test(index)
    && !index.includes('href="/buy/COMMANDER-DECK-DIAGNOSTIC-001')
    && !index.includes("href='/buy/COMMANDER-DECK-DIAGNOSTIC-001")
    && !/NZ\\$\\s*29/i.test(index),
  'Homepage does not market the held diagnostic or expose a buy route.');
check('diagnostic-not-marketed-on-public-mtg',
  !/Commander Deck Diagnostic|CMD-DIAG-29/i.test(mtg) && !/buy\.stripe\.com/i.test(mtg),
  'The served MTG store does not merchandise the held diagnostic.');

const plans = Array.isArray(truthPricing.plans) ? truthPricing.plans : [];
const expected = { SIGNAL: 4.99, INTELLIGENCE: 7.99, DEEP_EVIDENCE: 9.99 };
for (const [tier, price] of Object.entries(expected)) {
  const plan = plans.find((x) => String(x.tier || '').toUpperCase() === tier);
  check('truth-oracle-price-' + tier.toLowerCase(), !!plan && Number(plan.price_nzd_month) === price,
    `Truth Oracle ${tier} tier is NZD ${price.toFixed(2)}/month.`);
}

check('no-fake-payment-claim',
  !/RA_000001[^\n]{0,120}(?:PASS|VERIFIED|SUCCESS)/i.test(index + '\n' + catalogText + '\n' + mtg),
  'Public storefront does not claim a verified first customer payment.');

const secretPatterns = [/sk_live_/i, /sk_test_/i, /whsec_/i, /STRIPE_SECRET_KEY/i, /STRIPE_WEBHOOK_SECRET/i];
for (const [name, text] of [['index.html', index], ['catalog.json', catalogText], ['mtg/index.html', mtg]]) {
  check('public-secret-scan-' + name,
    !secretPatterns.some((re) => re.test(text)),
    `${name} contains no known Stripe secret material.`);
}

const proof = {
  schema: 'dreamledger/browning-economic-gate/v1',
  generated_at_utc: new Date().toISOString(),
  repository_sha: process.env.GITHUB_SHA || null,
  status: process.exitCode ? 'FAIL' : 'PASS',
  checks,
  invariant: 'payment -> fulfillment -> proof -> ledger',
  revenue_claim_status: 'UNPROVEN_UNTIL_AUTHORITATIVE_PAYMENT_EVIDENCE'
};
const proofPath = path.join(proofDir, 'BROWNING-ECONOMIC-GATE.json');
fs.writeFileSync(proofPath, JSON.stringify(proof, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(proof, null, 2));
console.log('proof_sha256=' + crypto.createHash('sha256').update(JSON.stringify(proof)).digest('hex'));
