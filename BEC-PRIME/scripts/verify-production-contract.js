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

const paymentLink = product.commercial_truth?.payment_link || '';
const featuredPaymentLink = featured.payment_link_url || '';
const approvedPaymentLink = offer?.payment_link_url || '';
const isStripeLink = value => typeof value === 'string'
  && /^https:\/\/(?:buy\.stripe\.com|checkout\.stripe\.com)\//i.test(value);
const productGateOpen = product.status === 'published'
  && product.commercial_truth?.approval_required === false
  && product.commercial_truth?.sellable === true
  && product.checkout_available === true
  && product.checkout?.mode === 'stripe'
  && isStripeLink(paymentLink);
const offerGateOpen = offer?.approval_required === false
  && offer?.checkout_available === true
  && offer?.status === 'VERIFIED_AVAILABLE'
  && isStripeLink(approvedPaymentLink)
  && approvedPaymentLink === paymentLink;
const featuredGateOpen = featured.public_visibility === 'featured'
  && featured.approval_required === false
  && featured.checkout_available === true
  && isStripeLink(featuredPaymentLink)
  && featuredPaymentLink === paymentLink;

if (productGateOpen) {
  if (!offerGateOpen || !featuredGateOpen) errors.push('COMMERCIAL_GATE_MISMATCH');
  if (offer?.payment_link_status !== 'ACTIVE_LIVEMODE' || featured.payment_link_status !== 'ACTIVE_LIVEMODE') {
    errors.push('STRIPE_LINK_NOT_LIVEMODE');
  }
} else {
  // A held canonical product must not be overridden by an older approved-offer
  // record or a featured homepage projection.
  const safelyHeld = product.commercial_truth?.approval_required === true
    && product.commercial_truth?.sellable === false
    && product.status !== 'published'
    && product.checkout?.mode === 'disabled'
    && offer?.approval_required === true
    && offer?.checkout_available === false
    && offer?.status === 'HELD'
    && !approvedPaymentLink
    && featured.approval_required === true
    && featured.checkout_available === false
    && featured.status === 'HELD_CANONICAL_PRODUCT_GATE'
    && featured.public_visibility !== 'featured'
    && !featuredPaymentLink
    && featured.checkout_url === 'https://dreamledger.org/mtg/';
  if (!safelyHeld) errors.push('HELD_PRODUCT_CHECKOUT_BYPASS');
  if (paymentLink || featuredPaymentLink || approvedPaymentLink) errors.push('HELD_PRODUCT_PAYMENT_URL_EXPOSED');
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