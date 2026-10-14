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

const index = read('public/home.html');
const catalogText = read('public/catalog.json');
const catalog = JSON.parse(catalogText);
const mtg = read('public/mtg/index.html');
const truthPricing = JSON.parse(read('BEC-PRIME/catalog/truth-oracle/pricing.json'));

check('homepage-canonical-doors',
  ['DreamLedger', 'Truth Oracle', 'Supplier Quote Comparison Worksheet'].every((x) => index.toLowerCase().includes(x.toLowerCase())) && !/Agent Delivery Proof Audit|agent-delivery-proof-audit/i.test(index),
  'Homepage exposes Truth Oracle and supplier quote comparison; the retired audit offer is absent.');
const canonicalDiagnosticLink = 'https://buy.stripe.com/eVqeVdc1T01n1DV3gwdwc30';
const legacyDiagnosticLink = 'https://buy.stripe.com/8x228r1nfg0l3M32csdwc2I';
check('diagnostic-current-public-catalog',
  Array.isArray(catalog.products) && catalog.products.some((x) => x && x.id === 'COMMANDER-DECK-DIAGNOSTIC-001' && x.sku === 'CMD-DIAG-29' && Number(x.price) === 29 && String(x.currency || '').toUpperCase() === 'NZD' && x.status === 'published' && x.checkout_available === true && x.checkout_url === canonicalDiagnosticLink) &&
    !catalog.products.some((x) => x && x.checkout_url === legacyDiagnosticLink),
  'Current Commander Deck Diagnostic CMD-DIAG-29 matches the canonical NZD 29 Stripe Payment Link in public/catalog.json.' );
check('diagnostic-current-public-mtg',
  /Commander diagnostic/i.test(mtg) && mtg.includes(canonicalDiagnosticLink) && !mtg.includes(legacyDiagnosticLink),
  'The real public MTG page exposes the canonical NZD 29 diagnostic route and no retired Payment Link.');

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
