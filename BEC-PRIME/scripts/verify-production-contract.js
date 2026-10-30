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
  'catalog/featured-offer.json',
  'fulfillment/PRODUCT-FULFILLMENT-REGISTRY.json'
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

// A successful *contract* is not a declaration that every stored offer is
// approved for sale. Held digital products must remain unpurchasable, even
// if Stripe still has an active historical Payment Link.
const held = product.status === 'held';
const fulfillment = readJson('fulfillment/PRODUCT-FULFILLMENT-REGISTRY.json');
const fulfillmentEntry = fulfillment.entries?.[product.id];
if (held) {
  const holds = {
    PRODUCT_CHECKOUT_NOT_DISABLED:
      product.checkout?.mode !== 'disabled' || product.checkout?.url != null,
    PRODUCT_IS_MISREPRESENTED_AS_SELLABLE:
      product.commercial_truth?.sellable !== false || product.commercial_truth?.approval_required !== true,
    PRODUCT_HAS_PAYMENT_SURFACE: Boolean(product.commercial_truth?.payment_link),
    HELD_FULFILLMENT_MISREPRESENTED_AS_READY:
      !fulfillmentEntry || fulfillmentEntry.ready !== false || fulfillmentEntry.operator_required !== true,
    HELD_OFFER_EXPOSED_AS_ACTIVE:
      !offer || offer.checkout_available !== false || offer.public_distribution_allowed !== false ||
      offer.activation_state !== 'HELD_NOT_SELLABLE',
    HELD_FEATURED_OFFER_EXPOSES_CHECKOUT:
      featured.public_visibility !== 'held' || featured.checkout_url != null ||
      featured.payment_link_url != null || featured.distribution_allowed !== false ||
      featured.activation_state !== 'HELD_NOT_SELLABLE',
    HISTORICAL_LINK_EVIDENCE_MISMATCH:
      !offer || !offer.payment_link_url || featured.historical_payment_link_url !== offer.payment_link_url
  };
  for (const [code, fails] of Object.entries(holds)) if (fails) errors.push(code);
} else {
  const paymentLink = product.commercial_truth?.payment_link || '';
  if (!paymentLink || featured.payment_link_url !== paymentLink ||
      offer?.payment_link_url !== paymentLink) errors.push('STRIPE_LINK_DRIFT');
  if (offer?.payment_link_status !== 'ACTIVE_LIVEMODE') errors.push('STRIPE_LINK_NOT_LIVEMODE');
  if (product.commercial_truth?.approval_required !== false ||
      product.commercial_truth?.sellable !== true ||
      product.checkout?.enabled !== true ||
      fulfillmentEntry?.ready !== true ||
      fulfillmentEntry?.operator_required !== false) errors.push('PRODUCT_NOT_SELLABLE');
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
  checked_at: new Date().toISOString(),
  canonical_offer: {
    offer_id: 'OFFER-CMD-DIAG-29-NZD',
    sku: 'CMD-DIAG-29',
    price_nzd: 29,
    payment_link_status: offer?.payment_link_status || null
  },
  commerce_state: held ? 'HELD_CHECKOUT_DISABLED' : 'PUBLISHED_REQUIRES_LIVE_VERIFICATION',
  sale_certified: false,
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