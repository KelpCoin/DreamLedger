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
  if (!fs.existsSync(file) || fs.statSync(file).size === 0) errors.push('MISSING:' + rel);
}

function readJson(rel) {
  try { return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')); }
  catch { errors.push('INVALID_JSON:' + rel); return {}; }
}

const product = readJson('catalog/products/COMMANDER-DECK-DIAGNOSTIC-001.json');
const registry = readJson('catalog/offers/approved.json');
const featured = readJson('catalog/featured-offer.json');
const approved = Array.isArray(registry.approved) ? registry.approved : [];
const held = Array.isArray(registry.held) ? registry.held : [];
const offerId = 'OFFER-CMD-DIAG-29-NZD';
const productId = 'COMMANDER-DECK-DIAGNOSTIC-001';
const sku = 'CMD-DIAG-29';
const offer = approved.find(x => x?.offer_id === offerId);
const heldOffer = held.find(x => x?.offer_id === offerId);
const isHeld = product.status === 'held' || product.commercial_truth?.sellable === false;

if (product.id !== productId || featured.product_id !== productId ||
    (offer || heldOffer)?.product_id !== productId) errors.push('IDENTITY_DRIFT');
if (product.sku !== sku || featured.sku !== sku ||
    (offer || heldOffer)?.product_sku !== sku) errors.push('SKU_DRIFT');
if (product.price !== 29 || featured.price !== 29 || (offer || heldOffer)?.price !== 29) errors.push('PRICE_DRIFT');

if (isHeld) {
  // A healthy production contract can deliberately be HELD. Passing this
  // check means the purchase path is consistently disabled, not saleable.
  if (!heldOffer) errors.push('HELD_CANONICAL_OFFER_MISSING');
  if (offer) errors.push('HELD_OFFER_PRESENT_IN_APPROVED_SET');
  if (product.status !== 'held' ||
      product.commercial_truth?.approval_required !== true ||
      product.commercial_truth?.sellable !== false ||
      product.checkout?.mode !== 'disabled' ||
      product.checkout?.url) errors.push('HELD_PRODUCT_CHECKOUT_NOT_DISABLED');
  if (featured.status !== 'held' ||
      featured.approval_required !== true ||
      featured.checkout_available !== false ||
      featured.public_visibility !== 'unavailable' ||
      featured.payment_link_url ||
      featured.checkout_url ||
      featured.payment_link_id) errors.push('FEATURED_OFFER_STILL_CHECKOUTABLE');
  if (!heldOffer ||
      heldOffer.hold_status !== 'HELD' ||
      heldOffer.approval_required !== true ||
      heldOffer.checkout_available !== false ||
      heldOffer.payment_link_url ||
      heldOffer.payment_link_id ||
      heldOffer.payment_link_status !== 'HELD') errors.push('HELD_REGISTRY_LEAKS_PURCHASE_PATH');
  if (featured.payment_link_url || featured.checkout_url) errors.push('FEATURED_CHECKOUT_URL_PRESENT');
} else {
  if (!offer) errors.push('CANONICAL_OFFER_MISSING');
  if (product.commercial_truth?.approval_required !== false || product.commercial_truth?.sellable !== true) {
    errors.push('PRODUCT_NOT_SELLABLE');
  }
  const productLink = product.commercial_truth?.payment_link || product.checkout?.url || '';
  if (!productLink ||
      (featured.payment_link_url || '') !== productLink ||
      (offer?.payment_link_url || '') !== productLink) errors.push('STRIPE_LINK_DRIFT');
  if (offer?.payment_link_status !== 'ACTIVE_LIVEMODE') errors.push('STRIPE_LINK_NOT_LIVEMODE');
  if (featured.status === 'held' || featured.checkout_available === false) errors.push('FEATURED_OFFER_NOT_ENABLED');
}

const homepageFile = path.join(root, 'compiled/website/index.html');
if (fs.existsSync(homepageFile)) {
  const homepage = fs.readFileSync(homepageFile, 'utf8');
  for (const forbidden of [
    'cinema-event-v1','/cinema.html','Amplissa','HappyHomarid','CollectorsCoast',
    'adult-only','adult only','stripe_secret_key','stripe_webhook_secret','/var/data/'
  ]) {
    if (homepage.includes(forbidden)) errors.push('PUBLIC_BOUNDARY_LEAK:' + forbidden);
  }
}

const result = {
  schema: 'BEC-PRIME/PRODUCTION-CONTRACT/v4',
  status: errors.length ? 'FAIL' : 'PASS',
  commercial_state: isHeld ? 'HELD_NO_CHECKOUT' : 'SELLABLE',
  interpretation: isHeld
    ? 'PASS means the currently held offer has no checkout URL in canonical registry/product/featured surfaces; it does not mean the offer is purchasable.'
    : 'PASS means the sellable offer registry agrees on identity, price and payment rail.',
  checked_at: new Date().toISOString(),
  canonical_offer: {
    offer_id: offerId,
    sku,
    price_nzd: 29,
    registry_state: offer ? 'APPROVED' : heldOffer ? 'HELD' : 'MISSING',
    payment_link_status: (offer || heldOffer)?.payment_link_status || null
  },
  excluded_surfaces: ['cinema','private-adult-boundary'],
  errors
};
fs.writeFileSync(path.join(root,'PROOF-PRODUCTION-CONTRACT.json'),JSON.stringify(result,null,2)+'\n','utf8');
console.log(JSON.stringify(result,null,2));
process.exit(errors.length ? 1 : 0);
