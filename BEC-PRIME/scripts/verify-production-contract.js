'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const repo = path.resolve(root, '..');
const errors = [];

const required = [
  'compiled/website/index.html',
  'compiled/website/mtg/index.html',
  'compiled/website/mtg/diagnostic.html',
  'compiled/website/truth-oracle.html',
  'compiled/website/truth-oracle.json',
  'compiled/website/transparency-policy.json',
  'catalog/products/COMMANDER-DECK-DIAGNOSTIC-001.json',
  'catalog/offers/approved.json',
  'catalog/featured-offer.json',
  'fulfillment/PRODUCT-FULFILLMENT-REGISTRY.json',
  'cube/manifests/mtg-diagnostic.json'
];

for (const rel of required) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file) || fs.statSync(file).size === 0) errors.push(`MISSING:${rel}`);
}

function readJson(rel) {
  const file = path.join(root, rel);
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { errors.push(`INVALID_JSON:${rel}`); return {}; }
}

function readText(rel) {
  const file = path.join(repo, rel);
  try { return fs.readFileSync(file, 'utf8'); }
  catch { errors.push(`UNREADABLE:${rel}`); return ''; }
}

const product = readJson('catalog/products/COMMANDER-DECK-DIAGNOSTIC-001.json');
const approved = readJson('catalog/offers/approved.json');
const featured = readJson('catalog/featured-offer.json');
const registry = readJson('fulfillment/PRODUCT-FULFILLMENT-REGISTRY.json');
const cube = readJson('cube/manifests/mtg-diagnostic.json');
const activeOffer = (approved.approved || []).find(x => x && x.offer_id === 'OFFER-CMD-DIAG-29-NZD');
const heldOffers = (approved.held || []).filter(x => x && x.offer_id === 'OFFER-CMD-DIAG-29-NZD');
const heldOffer = heldOffers[0];
const fulfillment = registry.entries && registry.entries['COMMANDER-DECK-DIAGNOSTIC-001'];
const master = readText('public/mtg/master.html');
const index = readText('public/index.html');
const shop = readText('public/shop.html');
const silo = readText('public/silos/commander-deck-diagnostic/index.html');
const compiled = readText('BEC-PRIME/compiled/website/mtg/diagnostic.html');

if (product.price !== 29 || featured.price !== 29 || heldOffer?.price !== 29) errors.push('REFERENCE_PRICE_DRIFT');
if (product.id !== 'COMMANDER-DECK-DIAGNOSTIC-001' || featured.product_id !== product.id || heldOffer?.product_id !== product.id) errors.push('PRODUCT_IDENTITY_DRIFT');
if (product.sku !== 'CMD-DIAG-29' || featured.sku !== product.sku || heldOffer?.product_sku !== product.sku) errors.push('PRODUCT_SKU_DRIFT');

if (product.status !== 'held') errors.push('PRODUCT_RELEASE_STATE_NOT_HELD');
if (product.checkout?.mode !== 'disabled' || product.commercial_truth?.sellable !== false || product.commercial_truth?.approval_required !== true) errors.push('PRODUCT_CHECKOUT_NOT_HELD');
if (product.fulfillment?.mode !== 'disabled' || product.fulfillment?.operator_required !== true) errors.push('PRODUCT_FULFILLMENT_NOT_HELD');
if (product.commercial_truth?.payment_surface !== null) errors.push('PRODUCT_PAYMENT_SURFACE_NOT_NULL');

if (activeOffer) errors.push('HELD_OFFER_STILL_APPROVED');
if (heldOffers.length !== 1) errors.push('HELD_OFFER_RECORD_MISSING_OR_DUPLICATED');
if (heldOffer && (heldOffer.status !== 'HELD' || heldOffer.payment_link_url !== null || heldOffer.payment_link_status !== 'HELD_NOT_PROMOTED')) errors.push('HELD_OFFER_EXPOSES_PURCHASE_RAIL');
const compiledCommander = readJson('catalog/offers/offers.json').offers.filter(x => x && x.offer_id === 'OFFER-CMD-DIAG-29-NZD');
if (compiledCommander.some(x => x.checkout_available === true || x.status === 'VERIFIED_AVAILABLE' || x.checkout_url || x.payment_link_url)) errors.push('COMPILED_HELD_OFFER_CAN_BE_PURCHASED');

if (featured.status !== 'HELD' || featured.public_visibility !== 'held' || featured.payment_link_url !== null ||
    featured.payment_link_status !== 'HELD_NOT_PROMOTED' || featured.checkout_url !== null) {
  errors.push('FEATURED_OFFER_EXPOSES_PURCHASE_RAIL');
}
if (featured.evidence_status !== 'awaiting_durable_fulfillment') errors.push('FEATURED_OFFER_EVIDENCE_STATE_DRIFT');

if (!fulfillment || fulfillment.ready !== false || fulfillment.operator_required !== true || !/HOLD/i.test(String(fulfillment.reason || ''))) {
  errors.push('FULFILLMENT_REGISTRY_FALSE_READINESS');
}
if (cube.sale_status !== 'held' || cube.checkout_enabled !== false) errors.push('CUBE_MANIFEST_RELEASE_STATE_DRIFT');

for (const [surfaceName, surface] of [['public/mtg/master.html', master], ['public/index.html', index], ['public/shop.html', shop], ['public/silos/commander-deck-diagnostic/index.html', silo]]) {
  if (/buy\.stripe\.com\//i.test(surface)) errors.push(`PUBLIC_DIRECT_STRIPE_LINK:${surfaceName}`);
}
if (/\/buy\/COMMANDER-DECK-DIAGNOSTIC-001/i.test(index)) errors.push('PUBLIC_INDEX_HAS_COMMANDER_CHECKOUT_ROUTE');
if (/Commander Deck Diagnostic[\s\S]{0,500}NZ\$29/i.test(shop)) errors.push('PUBLIC_SHOP_PROMOTES_HELD_DIAGNOSTIC');
if (!/temporarily held/i.test(master)) errors.push('MTG_MASTER_MISSING_HELD_STATE');
if (!/currently held/i.test(silo)) errors.push('COMMANDER_SILO_MISSING_HELD_STATE');
if (!/Currently held/i.test(compiled) || !/not available for purchase/i.test(compiled)) errors.push('COMPILED_DIAGNOSTIC_MISSING_HELD_STATE');
if (/\/api\/mtg\/diagnostic\/intake|buy\.stripe\.com|NZ\$29/i.test(compiled)) errors.push('COMPILED_DIAGNOSTIC_HAS_ACTIVE_CHECKOUT_SURFACE');

const result = {
  schema: 'BEC-PRIME/PRODUCTION-CONTRACT/v4',
  status: errors.length ? 'FAIL' : 'PASS',
  checked_at: new Date().toISOString(),
  canonical_offer: {
    offer_id: 'OFFER-CMD-DIAG-29-NZD',
    sku: 'CMD-DIAG-29',
    reference_price_nzd: 29,
    release_state: activeOffer ? 'UNEXPECTEDLY_APPROVED' : (heldOffer ? 'HELD' : 'MISSING')
  },
  verified_invariants: [
    'product, catalog, registry, CUBE manifest and public surfaces agree on held state',
    'held offer is excluded from approved checkout catalog',
    'no direct live Stripe payment URL is surfaced for Commander diagnostic',
    'sale price remains a reference value, not an active checkout promise'
  ],
  errors
};

fs.writeFileSync(path.join(root, 'PROOF-PRODUCTION-CONTRACT.json'), JSON.stringify(result, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(result, null, 2));
process.exit(errors.length ? 1 : 0);
