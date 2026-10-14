#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const failures = [];
const checks = [];
function check(id, ok, detail) {
  checks.push({ id, status: ok ? 'PASS' : 'FAIL', detail });
  if (!ok) failures.push(id);
}

let manifest, contract, catalogue, publicCatalogue, searchPage;
try {
  manifest = readJson('public/silos/mtg/silo.json');
  contract = readJson('public/silos/mtg/marketplace-contract.json');
  catalogue = readJson('public/data/mtg-catalog.json');
  publicCatalogue = readJson('public/catalog.json');
  searchPage = fs.readFileSync(path.join(root, 'mtg-search.html'), 'utf8');
} catch (error) {
  console.error(JSON.stringify({ status: 'FAIL', error: error.message }, null, 2));
  process.exit(1);
}

check('manifest-silo-is-mtg', manifest.slug === 'mtg', 'Master manifest slug must be mtg.');
check('manifest-contract-link', manifest.marketplace_contract === '/silos/mtg/marketplace-contract.json', 'Manifest points at the MTG marketplace contract.');
check('contract-schema', contract.schema === 'dreamledger/mtg-marketplace-contract/v1', 'Versioned marketplace contract exists.');
check('private-is-default', contract.collection_record?.visibility_default === 'private' || contract.doctrine?.collection_visibility_default === 'private', 'Collection visibility defaults to private.');
check('zero-basic-fee', contract.doctrine?.basic_listing_fee_nzd === 0 && contract.auction?.basic_listing_fee_nzd === 0 && contract.auction?.platform_bid_fee_nzd === 0, 'Basic listing and bid fees are zero.');
check('empty-clone-inventory', contract.clone_rules?.new_catalogue_must_start_empty === true, 'Clones cannot inherit inventory.');
check('payment-proof-gate', Array.isArray(contract.evidence?.no_revenue_until) && ['independent_external_payment', 'settled_payment', 'fulfillment', 'delivery_evidence'].every((x) => contract.evidence.no_revenue_until.includes(x)), 'Revenue requires settlement and fulfillment evidence.');
check('auction-safety-gates', ['server time is authoritative', 'seller cannot bid on own auction', 'bid history is append-only', 'bid ordering and auction closing are race-safe and idempotent'].every((x) => contract.auction?.invariants?.includes(x)), 'Auction invariants include identity, ordering and audit history.');
check('privacy-boundaries', ['private records are not returned by public APIs, search, counts, autocomplete, or matching', 'only explicitly tradeable or for_sale records may enter matching results'].every((x) => contract.collection_record?.privacy_rules?.includes(x)), 'Private and unavailable cards must not leak through search or matching.');
check('catalogue-silo-identity', catalogue.silo === 'mtg' && Array.isArray(catalogue.products), 'MTG catalogue has correct silo identity and products array.');
check('public-catalogue-shape', publicCatalogue.schema === 'dreamledger/public-catalogue/v1' && Array.isArray(publicCatalogue.products), 'Public commerce catalogue shape remains valid.');
check('search-uses-live-inventory', searchPage.includes("fetch('/api/mtg/marketplace/listings'") && !searchPage.includes('var SEED=') && !searchPage.includes('Sol Ring'), 'Public search uses the live listings API and contains no synthetic sample inventory.');

const knownBlockers = [];
for (const p of catalogue.products) {
  if (p.checkout_available === true && (!p.checkout_url || !/^https:\/\//i.test(p.checkout_url))) {
    knownBlockers.push({ sku: p.sku || p.id, issue: 'checkout_enabled_without_https_url' });
  }
  if (p.checkout_available === false && p.sale_mode === 'checkout') {
    knownBlockers.push({ sku: p.sku || p.id, issue: 'checkout_mode_disabled' });
  }
}
const publicById = new Map(publicCatalogue.products.map((p) => [p?.id, p]).filter(([id]) => id));
for (const p of catalogue.products) {
  const publicProduct = publicById.get(p?.id);
  if (publicProduct && Number(publicProduct.price) !== Number(p.price)) {
    knownBlockers.push({
      sku: p.sku || p.id,
      issue: 'price_mismatch_between_mtg_and_public_catalogue',
      mtg_catalogue_price: p.price,
      public_catalogue_price: publicProduct.price
    });
  }
}
const diagnostic = publicCatalogue.products.find((p) => p?.id === 'COMMANDER-DECK-DIAGNOSTIC-001');
const knownLegacyLink = 'https://buy.stripe.com/8x228r1nfg0l3M32csdwc2I';
if (diagnostic?.checkout_url === knownLegacyLink) {
  knownBlockers.push({ sku: diagnostic.sku, issue: 'legacy_diagnostic_payment_link_on_this_ref' });
}
const priceMismatch = catalogue.products.find((p) => p?.id === 'EDH_0001' && Number(p.price) === 230);
if (priceMismatch && priceMismatch.checkout_available !== false) {
  knownBlockers.push({ sku: priceMismatch.sku || priceMismatch.id, issue: 'known_price_mismatch_not_held' });
}

const output = {
  status: failures.length ? 'FAIL' : 'PASS_CONTRACT_ONLY',
  readiness: 'NOT_CERTIFIED',
  checks,
  failures,
  commercial_blockers_detected: knownBlockers,
  notes: [
    'PASS_CONTRACT_ONLY validates contract structure, not production behavior.',
    'Collection storage, import, privacy enforcement, auctions and promotion are not implemented by this contract alone.',
    'A successful check does not prove deployment, demand, settlement, fulfillment or revenue.'
  ]
};
console.log(JSON.stringify(output, null, 2));
if (failures.length) process.exit(1);
