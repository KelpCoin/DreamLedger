'use strict';

// Review-only candidate. Do not merge or deploy without authorized acceptance.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const repoRoot = path.join(root, '..');
const errors = [];

function requireFile(base, rel) {
  const filename = path.join(base, rel);
  if (!fs.existsSync(filename) || !fs.statSync(filename).isFile() || fs.statSync(filename).size === 0) {
    errors.push(`MISSING:${rel}`);
    return null;
  }
  return filename;
}
function readJson(base, rel) {
  const filename = requireFile(base, rel);
  if (!filename) return {};
  try { return JSON.parse(fs.readFileSync(filename, 'utf8')); }
  catch { errors.push(`INVALID_JSON:${rel}`); return {}; }
}
function html(base, rel) {
  const filename = requireFile(base, rel);
  return filename ? fs.readFileSync(filename, 'utf8') : '';
}
function expect(condition, error) { if (!condition) errors.push(error); }

const required = [
  'compiled/website/index.html',
  'compiled/website/mtg/index.html',
  'compiled/website/truth-oracle.html',
  'compiled/website/truth-oracle.json',
  'compiled/website/transparency-policy.json',
  'compiled/website/portfolio/index.html',
  'catalog/offers/approved.json',
  'catalog/featured-offer.json'
];
for (const rel of required) requireFile(root, rel);

const publicCatalog = readJson(repoRoot, 'public/catalog.json');
const rootDeck = readJson(repoRoot, 'catalog/products/EDH_0001.json');
const approved = readJson(root, 'catalog/offers/approved.json');
const featured = readJson(root, 'catalog/featured-offer.json');
const publicProducts = Array.isArray(publicCatalog.products) ? publicCatalog.products : [];
const approvedOffers = Array.isArray(approved.approved) ? approved.approved : [];
const getPublic = id => publicProducts.find(p => p && p.id === id);
const getApproved = id => approvedOffers.find(o => o && o.product_id === id);

// Historical approvals are provenance, never current authority to sell.
const heldProducts = [
  { id: 'COMMANDER-DECK-DIAGNOSTIC-001', page: 'commander-deck-diagnostic.html' },
  { id: 'DREAMLEDGER-BILLBOARD-FOUNDING-001', page: 'dreamledger-founding-tile.html' }
];
const heldLinks = [];
for (const held of heldProducts) {
  const p = readJson(root, `catalog/products/${held.id}.json`);
  const item = getPublic(held.id);
  const historical = getApproved(held.id);
  expect(p.id === held.id && Boolean(historical), `HELD_IDENTITY_OR_APPROVAL_MISSING:${held.id}`);
  expect(p.commercial_truth?.approval_required === true, `HELD_OPERATOR_GATE_OPEN:${held.id}`);
  expect(!['active', 'published'].includes(String(p.status || '').toLowerCase()), `HELD_PRODUCT_ACTIVE:${held.id}`);
  expect(item && item.checkout_available === false && !item.checkout_url, `HELD_PUBLIC_CHECKOUT_OPEN:${held.id}`);
  expect(p.commercial_truth?.sellable !== true, `HELD_PRODUCT_SELLABLE:${held.id}`);
  if (held.id === 'COMMANDER-DECK-DIAGNOSTIC-001') {
    expect(p.inventory === 0 && p.checkout?.mode === 'disabled' && p.fulfillment?.mode === 'disabled', 'HELD_DIAGNOSTIC_NOT_DISABLED');
    expect(p.price === 29 && featured.product_id === p.id && featured.price === p.price && historical?.price === p.price, 'HELD_DIAGNOSTIC_HISTORY_DRIFT');
  }
  if (historical && typeof historical.payment_link_url === 'string') heldLinks.push(historical.payment_link_url);
  const compiledPage = html(root, `compiled/website/portfolio/${held.page}`);
  const publicPage = html(repoRoot, `public/portfolio/${held.page}`);
  for (const [surface, page] of [['compiled', compiledPage], ['public', publicPage]]) {
    expect(/<meta\s+name=["']robots["']\s+content=["']noindex/i.test(page), `HELD_PAGE_NOT_NOINDEX:${held.id}:${surface}`);
    expect(/currently unavailable for purchase/i.test(page), `HELD_PAGE_NOT_UNAVAILABLE:${held.id}:${surface}`);
    expect(!/buy\.stripe\.com|>\s*Buy now\s*</i.test(page), `HELD_PAGE_PURCHASE_CTA:${held.id}:${surface}`);
  }
}

// The approved physical deck is independent of the held digital diagnostic.
const deckPublic = getPublic('EDH_0001');
const deckLink = rootDeck.commercial_truth?.payment_link;
expect(rootDeck.id === 'EDH_0001' && rootDeck.silo === 'mtg', 'DECK_IDENTITY_DRIFT');
expect(rootDeck.status === 'published' && rootDeck.inventory === 1 && rootDeck.fulfillment_method === 'physical_delivery', 'DECK_INVENTORY_OR_DELIVERY_DRIFT');
expect(rootDeck.price === 40000 && String(rootDeck.currency).toLowerCase() === 'nzd', 'DECK_MINOR_PRICE_DRIFT');
expect(deckPublic?.price === 400 && String(deckPublic?.currency).toLowerCase() === 'nzd', 'DECK_PUBLIC_PRICE_DRIFT');
expect(deckPublic?.checkout_available === true && deckPublic?.inventory === 1, 'DECK_PUBLIC_CHECKOUT_DRIFT');
expect(typeof deckLink === 'string' && /^https:\/\/buy\.stripe\.com\/[A-Za-z0-9]+$/.test(deckLink) && deckPublic?.checkout_url === deckLink, 'DECK_PAYMENT_LINK_DRIFT');
expect(rootDeck.commercial_truth?.payment_link_id === deckPublic?.payment_link_id && /^plink_[A-Za-z0-9]+$/.test(rootDeck.commercial_truth?.payment_link_id || ''), 'DECK_PAYMENT_LINK_ID_DRIFT');
expect(rootDeck.commercial_truth?.approval_required === false && rootDeck.commercial_truth?.checkout_available === true && Boolean(rootDeck.commercial_truth?.owner_approval), 'DECK_OWNER_APPROVAL_MISSING');
expect(rootDeck.commercial_truth?.stock_limited === true && rootDeck.commercial_truth?.completed_purchase_limit === 1 && deckPublic?.maximum_completed_purchases === 1, 'DECK_PURCHASE_LIMIT_DRIFT');
expect(deckPublic?.shipping_restriction === 'NZ', 'DECK_SHIPPING_DRIFT');

const portfolioIndex = html(repoRoot, 'public/portfolio/index.html');
const compiledIndex = html(root, 'compiled/website/portfolio/index.html');
const mtgPage = html(root, 'compiled/website/mtg/index.html');
for (const link of heldLinks) {
  for (const [surface, content] of [['public_portfolio', portfolioIndex], ['compiled_portfolio', compiledIndex], ['compiled_mtg', mtgPage]]) {
    expect(!content.includes(link), `HELD_LINK_EXPOSED:${surface}`);
  }
}
expect(!/<a\b[^>]*>\s*Buy diagnostic\s*<\/a>/i.test(mtgPage), 'HELD_DIAGNOSTIC_CTA_EXPOSED');

const homepage = html(root, 'compiled/website/index.html');
for (const forbidden of [
  'cinema-event-v1', '/cinema.html', 'Amplissa', 'HappyHomarid',
  'CollectorsCoast', 'adult-only', 'adult only',
  'stripe_secret_key', 'stripe_webhook_secret', '/var/data/'
]) expect(!homepage.includes(forbidden), `PUBLIC_BOUNDARY_LEAK:${forbidden}`);

const result = {
  schema: 'BEC-PRIME/PRODUCTION-CONTRACT/v3',
  status: errors.length ? 'FAIL' : 'PASS',
  checked_at: new Date().toISOString(),
  canonical_offer: { offer_id: 'EDH_0001', price_nzd: 400, stock_limit: 1, checkout_source: 'catalog/products/EDH_0001.json' },
  held_offers: heldProducts.map(p => p.id),
  gates: { code_and_catalog_contract: errors.length ? 'HOLD' : 'PASS', external_settlement_delivery: 'UNVERIFIED' },
  excluded_surfaces: ['cinema', 'private-adult-boundary'],
  errors
};
fs.writeFileSync(path.join(root, 'PROOF-PRODUCTION-CONTRACT.json'), JSON.stringify(result, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(result, null, 2));
process.exit(errors.length ? 1 : 0);
