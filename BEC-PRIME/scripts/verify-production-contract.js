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

// A held digital SKU intentionally has no public checkout/payment link on
// its product record. The approved/featured Stripe IDs remain reference-only.
const held = product.status === 'held' &&
  product.checkout?.mode === 'disabled' &&
  product.commercial_truth?.approval_required === true &&
  product.commercial_truth?.sellable === false;
const paymentLink = offer?.payment_link_url;
const productLink = product.commercial_truth?.payment_link;
if (!paymentLink || featured.payment_link_url !== paymentLink ||
    (productLink != null && productLink !== paymentLink) ||
    (!held && productLink !== paymentLink)) {
  errors.push('STRIPE_LINK_DRIFT');
}
if (!offer?.payment_link_id || featured.payment_link_id !== offer.payment_link_id) {
  errors.push('STRIPE_LINK_ID_DRIFT');
}
if (featured.payment_link_status !== offer?.payment_link_status) {
  errors.push('STRIPE_LINK_STATUS_DRIFT');
}
if (held) {
  // This is an expected release hold, not a reason to activate checkout.
  if (offer?.payment_link_status !== 'INACTIVE_LIVEMODE' ||
      featured.payment_link_status !== 'INACTIVE_LIVEMODE' ||
      offer?.release_status !== 'HOLD' ||
      featured.release_status !== 'HOLD' ||
      featured.public_visibility !== 'held') {
    errors.push('HELD_SOURCE_INCONSISTENT');
  }
  errors.push('STRIPE_LINK_NOT_LIVEMODE', 'PRODUCT_NOT_SELLABLE');
} else {
  if (offer?.payment_link_status !== 'ACTIVE_LIVEMODE') errors.push('STRIPE_LINK_NOT_LIVEMODE');
  if (product.commercial_truth?.approval_required !== false ||
      product.commercial_truth?.sellable !== true) errors.push('PRODUCT_NOT_SELLABLE');
  // Source declarations cannot attest live Stripe, signed settlement or delivery.
  // No local metadata flag can turn this source-only verifier into a release pass.
  errors.push('LIVE_PROVIDER_SETTLEMENT_AND_DELIVERY_UNVERIFIED');
}

const homepageFile = path.join(root, 'compiled/website/index.html');

if (fs.existsSync(homepageFile)) {
  const homepage = fs.readFileSync(homepageFile, 'utf8');

  for (const forbidden of [
    'cinema-event-v1',
    '/cinema.html',
    'Amplissa',
    'HappyHomarid',
    'CollectorsCoast',
    'adult-only',
    'adult only',
    'stripe_secret_key',
    'stripe_webhook_secret',
    '/var/data/'
  ]) {
    if (homepage.includes(forbidden)) {
      errors.push(`PUBLIC_BOUNDARY_LEAK:${forbidden}`);
    }
  }
}

const result = {
  schema: 'BEC-PRIME/PRODUCTION-CONTRACT/v3',
  status: errors.length ? 'FAIL' : 'PASS',
  release_gate: 'HOLD',
  catalogue_integrity: errors.some(x => /(?:_DRIFT|MISSING|INVALID_JSON|BOUNDARY_LEAK|INCONSISTENT)/.test(x)) ? 'FAIL' : 'PASS',
  release_reason: held ? 'EXPECTED_HELD_UNSELLABLE' : 'PROVIDER_SETTLEMENT_AND_DELIVERY_NOT_ATTESTED',
  checked_at: new Date().toISOString(),
  canonical_offer: {
    offer_id: 'OFFER-CMD-DIAG-29-NZD',
    sku: 'CMD-DIAG-29',
    price_nzd: 29,
    payment_link_status: offer?.payment_link_status || null
  },
  excluded_surfaces: ['cinema', 'private-adult-boundary'],
  errors
};

fs.writeFileSync(
  path.join(root, 'PROOF-PRODUCTION-CONTRACT.json'),
  JSON.stringify(result, null, 2) + '\n',
  'utf8'
);

console.log(JSON.stringify(result, null, 2));
process.exit(errors.length ? 1 : 0);