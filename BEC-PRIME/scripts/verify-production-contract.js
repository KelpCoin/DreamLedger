'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const errors = [];
const warnings = [];

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
  const file = path.join(root, rel);
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (_) {
    errors.push('INVALID_JSON:' + rel);
    return {};
  }
}

function readOptionalJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (_) { return null; }
}

function readOptionalText(file) {
  try { return fs.readFileSync(file, 'utf8'); }
  catch (_) { return ''; }
}

const product = readJson('catalog/products/COMMANDER-DECK-DIAGNOSTIC-001.json');
const approved = readJson('catalog/offers/approved.json');
const featured = readJson('catalog/featured-offer.json');
const liveCatalog = readJson('catalog/commerce-live.json');
const fulfillment = readJson('fulfillment/PRODUCT-FULFILLMENT-REGISTRY.json');
const offer = (approved.approved || []).find(x => x && x.offer_id === 'OFFER-CMD-DIAG-29-NZD') || null;
const liveOffer = (liveCatalog.offers || []).find(x => x && x.offer_id === 'OFFER-CMD-DIAG-29-NZD') || null;
const fulfillmentEntry = fulfillment.entries && fulfillment.entries['COMMANDER-DECK-DIAGNOSTIC-001'] || null;
const publicCatalog = readOptionalJson(path.join(root, '..', 'public', 'catalog.json'));
const publicProduct = publicCatalog && (publicCatalog.products || []).find(x => x.id === 'COMMANDER-DECK-DIAGNOSTIC-001');
const heldRoute = readOptionalText(path.join(root, '..', 'public', 'buy', 'commander-deck-diagnostic-001', 'index.html'));
const publicMtg = readOptionalText(path.join(root, '..', 'public', 'mtg', 'index.html'));
const publicBillboard = readOptionalText(path.join(root, '..', 'public', 'billboard.html'));

if (!offer) errors.push('CANONICAL_OFFER_MISSING');
if (product.price !== 29 || featured.price !== 29 || offer && offer.price !== 29) errors.push('PRICE_DRIFT');
if (product.id !== 'COMMANDER-DECK-DIAGNOSTIC-001' ||
    featured.product_id !== product.id ||
    offer && offer.product_id !== product.id) errors.push('IDENTITY_DRIFT');
if (product.sku !== 'CMD-DIAG-29' ||
    featured.sku !== 'CMD-DIAG-29' ||
    offer && offer.product_sku !== 'CMD-DIAG-29') errors.push('SKU_DRIFT');

const safeHold =
  product.status === 'held' &&
  Number(product.inventory) === 0 &&
  product.checkout && product.checkout.mode === 'disabled' &&
  product.checkout.url == null &&
  product.commercial_truth && product.commercial_truth.approval_required === true &&
  product.commercial_truth.sellable === false &&
  !product.commercial_truth.payment_link &&
  featured.public_visibility === 'held' &&
  featured.payment_link_url == null &&
  featured.checkout_url === '/buy/commander-deck-diagnostic-001/' &&
  offer && offer.payment_link_url == null &&
  offer.payment_link_status === 'INACTIVE_LIVEMODE' &&
  heldRoute.includes('not available for purchase') &&
  !heldRoute.includes('buy.stripe.com') &&
  publicProduct && publicProduct.status === 'held' &&
  publicProduct.checkout_available === false &&
  publicProduct.checkout_url == null;

if (safeHold) {
  if (publicMtg.includes('buy.stripe.com')) errors.push('SAFE_HOLD_PUBLIC_MTG_HAS_DIRECT_STRIPE_URL');
  if (publicBillboard.includes('buy.stripe.com')) errors.push('SAFE_HOLD_PUBLIC_BILLBOARD_HAS_DIRECT_STRIPE_URL');
  if (!publicMtg.includes('/buy/COMMANDER-DECK-DIAGNOSTIC-001') &&
      !publicMtg.includes('/buy/commander-deck-diagnostic-001/')) {
    errors.push('SAFE_HOLD_PUBLIC_MTG_ROUTE_MISSING');
  }
  if (liveOffer && (liveOffer.status === 'ACTIVE_LIVEMODE' || liveOffer.checkout)) {
    warnings.push('LIVE_COMMERCE_CATALOGUE_STALE: a live-catalogue record still advertises an unverified checkout');
  }
  if (fulfillmentEntry && fulfillmentEntry.ready === true) {
    warnings.push('FULFILLMENT_REGISTRY_CONTRADICTS_PRODUCT_HOLD: product remains held despite ready=true');
  }
  warnings.push('ECONOMIC_RELEASE_BLOCKED: no coherent approved offer; no checkout or revenue claim is authorized');
} else {
  const paymentLink = product.commercial_truth && product.commercial_truth.payment_link || '';
  if (product.commercial_truth && product.commercial_truth.payment_link !== paymentLink ||
      featured.payment_link_url !== paymentLink ||
      offer && offer.payment_link_url !== paymentLink) errors.push('STRIPE_LINK_DRIFT');
  if (offer && offer.payment_link_status !== 'ACTIVE_LIVEMODE') errors.push('STRIPE_LINK_NOT_LIVEMODE');
  if (!product.commercial_truth ||
      product.commercial_truth.approval_required !== false ||
      product.commercial_truth.sellable !== true) errors.push('PRODUCT_NOT_SELLABLE');
  if (!fulfillmentEntry || fulfillmentEntry.ready !== true) errors.push('FULFILLMENT_NOT_READY');
}

const homepageFile = path.join(root, 'compiled/website/index.html');
if (fs.existsSync(homepageFile)) {
  const homepage = fs.readFileSync(homepageFile, 'utf8');
  for (const forbidden of [
    'cinema-event-v1', '/cinema.html', 'Amplissa', 'HappyHomarid', 'CollectorsCoast',
    'adult-only', 'adult only', 'stripe_secret_key', 'stripe_webhook_secret', '/var/data/'
  ]) {
    if (homepage.includes(forbidden)) errors.push('PUBLIC_BOUNDARY_LEAK:' + forbidden);
  }
}

const result = {
  schema: 'BEC-PRIME/PRODUCTION-CONTRACT/v4',
  status: errors.length ? 'FAIL' : safeHold ? 'SAFE_HOLD_WITH_BLOCKERS' : 'PASS',
  build_allowed: errors.length === 0,
  economic_release_allowed: errors.length === 0 && !safeHold && warnings.length === 0,
  checked_at: new Date().toISOString(),
  canonical_offer: {
    offer_id: 'OFFER-CMD-DIAG-29-NZD',
    sku: 'CMD-DIAG-29',
    price_nzd: 29,
    configured_payment_link_status: offer && offer.payment_link_status || null,
    public_checkout: safeHold ? 'HELD' : 'ACTIVE'
  },
  warnings,
  errors,
  excluded_surfaces: ['cinema', 'private-adult-boundary']
};

fs.writeFileSync(
  path.join(root, 'PROOF-PRODUCTION-CONTRACT.json'),
  JSON.stringify(result, null, 2) + '\n',
  'utf8'
);
console.log(JSON.stringify(result, null, 2));
process.exit(errors.length ? 1 : 0);
