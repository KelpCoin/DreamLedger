'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { buildOfferParityReceipt } = require('../economic/StripePaymentLinkResolver');

const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, '..', 'public');
const OUT = path.join(ROOT, 'data', '777', 'STRIPE-OFFER-PARITY-LATEST.json');

function loadJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) {
    if (error && error.code === 'ENOENT') return fallback;
    throw error;
  }
}

function publicPageFor(offer) {
  if (offer.product_id === 'COMMANDER-DECK-DIAGNOSTIC-001') {
    return { route: '/mtg/', source_path: 'public/mtg/index.html', purchase_route: '/buy/commander-deck-diagnostic-001/' };
  }
  if (offer.product_id === 'DREAMLEDGER-BILLBOARD-FOUNDING-001') {
    return { route: '/billboard.html', source_path: 'public/billboard.html', purchase_route: '/buy/dreamledger-billboard-founding-001/' };
  }
  return null;
}

async function stripeGet(secret, apiPath, params = {}) {
  const url = new URL('https://api.stripe.com/v1/' + apiPath.replace(/^\/+/, ''));
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }
  const response = await fetch(url, {
    method: 'GET',
    headers: { Authorization: 'Bearer ' + secret, Accept: 'application/json' },
    signal: AbortSignal.timeout(20000)
  });
  const body = await response.text();
  let data;
  try { data = JSON.parse(body); } catch { data = null; }
  if (!response.ok) {
    const code = data && data.error && data.error.code || 'STRIPE_API_ERROR';
    throw new Error('Stripe GET failed (' + response.status + ', ' + code + ') on ' + apiPath);
  }
  if (!data || typeof data !== 'object') throw new Error('Stripe returned invalid JSON for ' + apiPath);
  return data;
}

async function fetchAllPaymentLinks(secret) {
  const links = [];
  let startingAfter = null;
  for (let page = 0; page < 30; page++) {
    const params = { limit: 100, 'expand[]': 'data.line_items' };
    if (startingAfter) params.starting_after = startingAfter;
    const result = await stripeGet(secret, 'payment_links', params);
    const data = Array.isArray(result.data) ? result.data : [];
    links.push(...data);
    if (!result.has_more) return links;
    if (!data.length || !data[data.length - 1].id) throw new Error('Stripe payment-link pagination cursor missing');
    startingAfter = data[data.length - 1].id;
  }
  throw new Error('Stripe payment-link pagination exceeded 30 pages');
}

async function fetchLineItems(secret, link) {
  const result = await stripeGet(secret, 'payment_links/' + encodeURIComponent(link.id) + '/line_items', { limit: 100 });
  const rows = Array.isArray(result.data) ? result.data : [];
  return Promise.all(rows.map(async row => {
    let price = row.price && typeof row.price === 'object' ? row.price : null;
    if (!price || price.unit_amount == null || !price.currency) {
      const priceId = typeof row.price === 'string' ? row.price : price && price.id;
      if (!priceId) return { ...row, unit_amount: null, currency: null };
      price = await stripeGet(secret, 'prices/' + encodeURIComponent(priceId));
    }
    return {
      quantity: row.quantity ?? 1,
      unit_amount: price.unit_amount ?? null,
      currency: price.currency ?? null,
      price: {
        id: price.id || (typeof row.price === 'string' ? row.price : null),
        unit_amount: price.unit_amount ?? null,
        currency: price.currency ?? null,
        recurring: price.recurring ?? null,
        product: typeof price.product === 'string' ? price.product : price.product && price.product.id || null
      }
    };
  }));
}

function pricePath(offer, skuOrId) {
  const direct = [
    'COMMANDER-DECK-DIAGNOSTIC-001',
    'DREAMLEDGER-BILLBOARD-FOUNDING-001'
  ];
  if (direct.includes(offer.product_id)) {
    return [
      'public/mtg/index.html',
      'public/buy/' + offer.product_id.toLowerCase() + '/index.html'
    ];
  }
  const id = String(skuOrId || offer.product_id || '').toLowerCase();
  return id ? ['public/products/' + id + '/index.html'] : [];
}

function readPublicPage(offer) {
  const sources = pricePath(offer, offer.product_sku);
  for (const relative of sources) {
    const file = path.join(PUBLIC, relative.replace(/^public\//, ''));
    if (!fs.existsSync(file)) continue;
    const html = fs.readFileSync(file, 'utf8');
    const held = /Offer currently held|not available for purchase|checkout_available\s*[:=]\s*false/i.test(html);
    const match = html.match(/(?:NZ\s*\$|NZD\s*\$?)\s*([0-9]+(?:\.[0-9]{1,2})?)/i);
    const routeLink = html.match(/href=["']([^"']*buy[^"']*)["']/i);
    return {
      route: offer.silo === 'mtg' ? '/mtg/' : null,
      source_path: relative,
      purchase_route: routeLink ? routeLink[1] : null,
      displayed_amount_nzd: match ? Number(match[1]) : null,
      checkout_held: held
    };
  }
  const generic = publicPageFor(offer);
  if (!generic) return null;
  const file = path.join(PUBLIC, generic.source_path.replace(/^public\//, ''));
  if (!fs.existsSync(file)) return { ...generic, source_present: false };
  const html = fs.readFileSync(file, 'utf8');
  const held = /Offer currently held|not available for purchase|checkout_available\s*[:=]\s*false/i.test(html);
  const match = html.match(/(?:NZ\s*\$|NZD\s*\$?)\s*([0-9]+(?:\.[0-9]{1,2})?)/i);
  return { ...generic, source_present: true, displayed_amount_nzd: match ? Number(match[1]) : null, checkout_held: held };
}

async function run() {
  const secret = process.env.STRIPE_SECRET_KEY || '';
  if (!/^(sk|rk)_live_/.test(secret)) {
    throw new Error('A live Stripe API key is required; the audit refuses test-mode or missing credentials.');
  }

  const approved = loadJson(path.join(ROOT, 'catalog', 'offers', 'approved.json'), { approved: [] });
  const live = loadJson(path.join(ROOT, 'catalog', 'commerce-live.json'), { offers: [] });
  const pub = loadJson(path.join(PUBLIC, 'catalog.json'), { products: [] });
  const registry = loadJson(path.join(ROOT, 'fulfillment', 'PRODUCT-FULFILLMENT-REGISTRY.json'), { entries: {} });
  const allLinks = await fetchAllPaymentLinks(secret);
  const approvedOffers = Array.isArray(approved.approved) ? approved.approved : [];
  const liveOffers = Array.isArray(live.offers) ? live.offers : [];
  const products = Array.isArray(pub.products) ? pub.products : [];
  const urlCandidates = new Set();
  for (const offer of approvedOffers) if (offer.payment_link_url) urlCandidates.add(offer.payment_link_url);
  for (const offer of liveOffers) if (offer.checkout) urlCandidates.add(offer.checkout);
  for (const product of products) if (product.checkout_url || product.payment_link_url) urlCandidates.add(product.checkout_url || product.payment_link_url);

  const linksToInspect = new Map();
  for (const url of urlCandidates) {
    const link = allLinks.find(item => item.url === url);
    if (link) linksToInspect.set(link.id, link);
  }
  for (const offer of approvedOffers) {
    for (const link of allLinks) {
      const values = [offer.offer_id, offer.product_id, offer.product_sku, offer.sku, offer.sku_id]
        .filter(Boolean).map(value => String(value).toLowerCase());
      const metadata = link.metadata || {};
      const matches = Object.entries(metadata).some(([key, value]) =>
        /offer_id|product_id|product_sku|sku|sku_id/i.test(key) && values.includes(String(value || '').toLowerCase()));
      if (matches) linksToInspect.set(link.id, link);
    }
  }

  const lineItemsByLinkId = {};
  const inspected = [...linksToInspect.values()];
  for (let offset = 0; offset < inspected.length; offset += 4) {
    const batch = inspected.slice(offset, offset + 4);
    const resolved = await Promise.all(batch.map(async item => [item.id, await fetchLineItems(secret, item)]));
    for (const [id, rows] of resolved) lineItemsByLinkId[id] = rows;
  }

  const receipts = approvedOffers.map(offer => {
    const liveOffer = liveOffers.find(item => item.offer_id === offer.offer_id) || null;
    const ids = [offer.product_id, offer.product_sku].filter(Boolean).map(String);
    const product = products.find(item => ids.includes(String(item.id)) || ids.includes(String(item.sku))) || null;
    let fulfillmentEntry = null;
    for (const id of [offer.product_id, offer.product_sku, product && product.id, product && product.sku].filter(Boolean)) {
      if (registry.entries && registry.entries[id]) { fulfillmentEntry = registry.entries[id]; break; }
    }
    const page = readPublicPage(offer);
    return {
      ...buildOfferParityReceipt({
        offer, liveOffer, publicProduct: product, stripeLinks: allLinks,
        lineItemsByLinkId, apiMode: 'live', fulfillmentEntry, publicPage: page
      })
    };
  });

  const output = {
    schema: 'DREAMLEDGER/777/STRIPE-PROVIDER-AUDIT/v1',
    generated_at: new Date().toISOString(),
    environment: 'LIVE_READ_ONLY',
    operation_allowlist: ['GET /v1/payment_links', 'GET /v1/payment_links/{id}/line_items', 'GET /v1/prices/{id}'],
    provider_link_count: allLinks.length,
    provider_links_inspected: inspected.length,
    approved_offer_count: approvedOffers.length,
    coherent_offer_count: receipts.filter(item => item.coherent).length,
    receipts,
    provider_observed: true,
    verified_revenue_nzd: 0,
    revenue_claim_permitted: false,
    mutations_performed: false,
    note: 'Provider configuration inspection is not evidence of a customer payment or fulfillment.'
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(output, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({
    status: 'PROVIDER_AUDIT_COMPLETE',
    environment: output.environment,
    provider_link_count: output.provider_link_count,
    approved_offer_count: output.approved_offer_count,
    coherent_offer_count: output.coherent_offer_count,
    receipt_summary: receipts.map(item => ({
      sku: item.sku,
      offer_id: item.offer_id,
      coherent: item.coherent,
      first_divergence: item.first_divergence,
      blockers: item.blocker_codes.length
    })),
    verified_revenue_nzd: 0,
    mutations_performed: false,
    output: path.relative(ROOT, OUT)
  }, null, 2));
  return output;
}

if (require.main === module) {
  run().catch(error => {
    console.error(JSON.stringify({ status: 'PROVIDER_AUDIT_FAILED', error: error.message, mutations_performed: false }));
    process.exitCode = 1;
  });
}

module.exports = { run, fetchAllPaymentLinks, fetchLineItems, buildOfferParityReceipt };
