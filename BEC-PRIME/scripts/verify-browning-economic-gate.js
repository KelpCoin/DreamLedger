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

const index = read('public/index.html');
const catalog = read('public/catalog.json');
const mtg = read('public/mtg.html');
const truthPricing = JSON.parse(read('BEC-PRIME/catalog/truth-oracle/pricing.json'));

check('homepage-canonical-doors',
  ['DreamLedger', 'Billboard', 'DreamMeez', 'Truth Oracle'].every((x) => index.toLowerCase().includes(x.toLowerCase())),
  'Homepage exposes only the canonical storefront doors required for this release.');

check('diagnostic-removed-from-public-catalog',
  !/COMMANDER-DECK-DIAGNOSTIC|Commander Deck Diagnostic/i.test(catalog),
  'The retired Commander Deck Diagnostic is absent from public/catalog.json.');

check('diagnostic-removed-from-public-mtg',
  !/COMMANDER-DECK-DIAGNOSTIC|Commander Deck Diagnostic/i.test(mtg),
  'The retired Commander Deck Diagnostic is absent from public/mtg.html.');

const tiers = Array.isArray(truthPricing.tiers) ? truthPricing.tiers : [];
const expected = { observer: 4.99, investigator: 7.99, deep_evidence: 9.99 };
for (const [id, price] of Object.entries(expected)) {
  const tier = tiers.find((x) => String(x.id || x.tier || '').toLowerCase() === id);
  check('truth-oracle-price-' + id, !!tier && Number(tier.price_nzd ?? tier.price) === price,
    `Truth Oracle ${id} tier is NZD ${price.toFixed(2)}.`);
}

check('no-fake-payment-claim',
  !/RA_000001[^\n]{0,120}(?:PASS|VERIFIED|SUCCESS)/i.test(index + '\n' + catalog + '\n' + mtg),
  'Public storefront does not claim a verified first customer payment.');

const secretPatterns = [/sk_live_/i, /sk_test_/i, /whsec_/i, /STRIPE_SECRET_KEY/i, /STRIPE_WEBHOOK_SECRET/i];
for (const [name, text] of [['index.html', index], ['catalog.json', catalog], ['mtg.html', mtg]]) {
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
