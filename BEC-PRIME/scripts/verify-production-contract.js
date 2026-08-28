'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const errors = [];

const required = [
  'compiled/website/index.html',
  'compiled/website/mtg/index.html',
  'compiled/website/truth-oracle.html',
  'compiled/website/truth-oracle.json',
  'compiled/website/transparency-policy.json',
  'catalog/products/COMMANDER-DECK-DIAGNOSTIC-001.json',
  'catalog/offers/approved.json',
  'catalog/featured-offer.json'
];

for (const rel of required) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file) || fs.statSync(file).size === 0) {
    errors.push(`MISSING:${rel}`);
  }
}

function readJson(rel) {
  const file = path.join(root, rel);
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    errors.push(`INVALID_JSON:${rel}`);
    return {};
  }
}

const product = readJson('catalog/products/COMMANDER-DECK-DIAGNOSTIC-001.json');
const approved = readJson('catalog/offers/approved.json');
const featured = readJson('catalog/featured-offer.json');

const offer = (approved.approved || []).find(
  x => x && x.offer_id === 'OFFER-CMD-DIAG-29-NZD'
);

if (!offer) errors.push('CANONICAL_OFFER_MISSING');

if (product.price !== 29 || featured.price !== 29 || offer?.price !== 29) {
  errors.push('PRICE_DRIFT');
}

if (
  product.id !== 'COMMANDER-DECK-DIAGNOSTIC-001' ||
  featured.product_id !== product.id ||
  offer?.product_id !== product.id
) {
  errors.push('IDENTITY_DRIFT');
}

if (
  product.sku !== 'CMD-DIAG-29' ||
  featured.sku !== 'CMD-DIAG-29' ||
  offer?.product_sku !== 'CMD-DIAG-29'
) {
  errors.push('SKU_DRIFT');
}

const paymentLink = 'https://buy.stripe.com/9B6aEX5DvdSd4Q73gwdwc1V';

if (
  product.commercial_truth?.payment_link !== paymentLink ||
  featured.payment_link_url !== paymentLink ||
  offer?.payment_link_url !== paymentLink
) {
  errors.push('STRIPE_LINK_DRIFT');
}

const homepageFile = path.join(root, 'compiled/website/index.html');

if (fs.existsSync(homepageFile)) {
  const homepage = fs.readFileSync(homepageFile, 'utf8');

  for (const forbidden of [
    'cinema-event-v1',
    '/cinema.html',
    'dreamiez',
    'Dreamiez'
  ]) {
    if (homepage.includes(forbidden)) {
      errors.push(`EXCLUDED_SURFACE:${forbidden}`);
    }
  }
}

const result = {
  schema: 'BEC-PRIME/PRODUCTION-CONTRACT/v2',
  status: errors.length ? 'FAIL' : 'PASS',
  checked_at: new Date().toISOString(),
  canonical_offer: {
    offer_id: 'OFFER-CMD-DIAG-29-NZD',
    sku: 'CMD-DIAG-29',
    price_nzd: 29,
    payment_link_status: offer?.payment_link_status || null
  },
  errors
};

fs.writeFileSync(
  path.join(root, 'PROOF-PRODUCTION-CONTRACT.json'),
  JSON.stringify(result, null, 2) + '\n',
  'utf8'
);

console.log(JSON.stringify(result, null, 2));
process.exit(errors.length ? 1 : 0);