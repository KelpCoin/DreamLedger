'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const CONFIG_DIR = path.join(ROOT, 'catalog', 'configurator');
const ORDERS_DIR = path.join(ROOT, 'data', 'mtg', 'orders');
const PRODUCT_DIR = path.join(ROOT, 'catalog', 'products');
const PUBLIC_BASE = (process.env.PUBLIC_BASE_URL || 'https://dreamledger.org').replace(/\/$/, '');
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';

function send(res, status, body) {
  if (res.writableEnded) return;
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function product(id) { const file = path.join(PRODUCT_DIR, String(id) + '.json'); return fs.existsSync(file) ? readJson(file) : null; }
function config(id) { const file = path.join(CONFIG_DIR, String(id) + '.json'); return fs.existsSync(file) ? readJson(file) : null; }
function jsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; if (raw.length > 200000) req.destroy(new Error('Request too large')); });
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch (err) { reject(err); } });
    req.on('error', reject);
  });
}
function form(params) { const out = new URLSearchParams(); for (const [key, value] of Object.entries(params)) out.set(key, String(value)); return out; }
async function stripeCheckout(params, idempotencyKey) {
  if (!STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not configured');
  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + STRIPE_SECRET_KEY, 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': idempotencyKey },
    body: form(params)
  });
  const text = await response.text();
  let data; try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!response.ok) throw new Error(data?.error?.message || 'Stripe API ' + response.status);
  return data;
}
function indexById(items) { const map = new Map(); for (const item of Array.isArray(items) ? items : []) map.set(String(item.id), item); return map; }
function validateSelection(c, body) {
  const landMap = indexById(c.customization.land_packages);
  const upgradeMap = indexById(c.customization.premium_upgrades);
  const flexMap = new Map((c.customization.flex_slots || []).map(slot => [String(slot.id), slot]));
  const landId = String(body.land_package || c.defaults.land_package);
  const land = landMap.get(landId);
  if (!land || land.status !== 'AVAILABLE') throw new Error('LAND_PACKAGE_NOT_AVAILABLE');
  const selectedFlex = Array.isArray(body.flex_slots) ? body.flex_slots : [];
  if (selectedFlex.length > c.limits.max_flex_slots) throw new Error('TOO_MANY_FLEX_SLOTS');
  const flexSelections = [];
  for (const selection of selectedFlex) {
    const slotId = String(selection.slot_id || '');
    const optionId = String(selection.option_id || '');
    const slot = flexMap.get(slotId);
    if (!slot) throw new Error('INVALID_FLEX_SLOT');
    const option = (slot.options || []).find(item => String(item.id) === optionId);
    if (!option || option.status !== 'AVAILABLE') throw new Error('FLEX_OPTION_NOT_AVAILABLE');
    flexSelections.push({ slot_id: slotId, option_id: optionId, name: option.name, price_adjustment_minor: Number(option.price_adjustment_minor || 0) });
  }
  const selectedUpgrades = Array.isArray(body.premium_upgrades) ? body.premium_upgrades : [];
  if (selectedUpgrades.length > c.limits.max_premium_upgrades) throw new Error('TOO_MANY_PREMIUM_UPGRADES');
  const upgrades = [];
  for (const id of selectedUpgrades) {
    const item = upgradeMap.get(String(id));
    if (!item || item.status !== 'AVAILABLE') throw new Error('PREMIUM_UPGRADE_NOT_AVAILABLE');
    upgrades.push({ id: item.id, name: item.name, price_adjustment_minor: Number(item.price_adjustment_minor || 0) });
  }
  return { land: { id: land.id, name: land.name, price_adjustment_minor: Number(land.price_adjustment_minor || 0) }, flex: flexSelections, upgrades };
}
function price(c, selection) {
  const base = Number(c.base_price_minor);
  const land = Number(selection.land.price_adjustment_minor || 0);
  const flex = selection.flex.reduce((n, item) => n + Number(item.price_adjustment_minor || 0), 0);
  const upgrades = selection.upgrades.reduce((n, item) => n + Number(item.price_adjustment_minor || 0), 0);
  return { base_minor: base, land_minor: land, flex_minor: flex, upgrades_minor: upgrades, total_minor: base + land + flex + upgrades };
}
async function handle(req, res, url) {
  const prefix = '/api/mtg/configurator';
  if (req.method === 'GET' && url === prefix + '/decks') {
    const files = fs.existsSync(CONFIG_DIR) ? fs.readdirSync(CONFIG_DIR).filter(name => name.endsWith('.json')) : [];
    const decks = files.map(name => readJson(path.join(CONFIG_DIR, name))).filter(item => item.status === 'LIVE_CONFIGURABLE').map(item => ({
      deck_id: item.deck_id, name: item.name, commander: item.commander, theme: item.theme, strategy: item.strategy,
      base_price_minor: item.base_price_minor, currency: item.currency, bracket_target: item.bracket_target,
      testing_status: item.testing_status, inventory_status: item.inventory_status, customization_enabled: true
    }));
    return send(res, 200, { decks });
  }
  const match = url.match(/^\/api\/mtg\/configurator\/decks\/([^/]+)(?:\/(price|order))?$/);
  if (!match) return false;
  const deckId = decodeURIComponent(match[1]);
  const action = match[2] || null;
  const c = config(deckId);
  const p = product(deckId);
  if (!c || !p) return send(res, 404, { error: 'CONFIGURATOR_DECK_NOT_FOUND' });
  if (c.status !== 'LIVE_CONFIGURABLE') return send(res, 403, { error: 'CONFIGURATOR_DECK_NOT_LIVE' });
  if (p.status !== 'published' || Number(p.inventory || 0) < 1) return send(res, 409, { error: 'BASE_DECK_NOT_AVAILABLE' });
  if (req.method === 'GET' && !action) return send(res, 200, {
    deck_id: c.deck_id, name: c.name, commander: c.commander, theme: c.theme, strategy: c.strategy,
    bracket_target: c.bracket_target, base_price_minor: c.base_price_minor, currency: c.currency,
    testing_status: c.testing_status, testing_note: c.testing_note, primer_status: c.primer_status,
    customization: c.customization, defaults: c.defaults, limits: c.limits
  });
  if (req.method === 'POST' && action === 'price') {
    try { const selection = validateSelection(c, await jsonBody(req)); const priced = price(c, selection); return send(res, 200, { deck_id: c.deck_id, currency: c.currency, selection, pricing: priced }); }
    catch (err) { return send(res, 400, { error: err.message || 'INVALID_CONFIGURATION' }); }
  }
  if (req.method === 'POST' && action === 'order') {
    try {
      const selection = validateSelection(c, await jsonBody(req));
      const priced = price(c, selection);
      const orderId = 'MTGCFG-' + new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14) + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
      const order = { schema_version: 'mtg-configured-order-v1', order_id: orderId, deck_id: c.deck_id, product_id: p.id, silo: 'mtg', status: 'CHECKOUT_PENDING', selection, pricing: priced, currency: c.currency, created_at: new Date().toISOString() };
      fs.mkdirSync(ORDERS_DIR, { recursive: true });
      fs.writeFileSync(path.join(ORDERS_DIR, orderId + '.json'), JSON.stringify(order, null, 2) + '\n', 'utf8');
      const params = {
        mode: 'payment', success_url: PUBLIC_BASE + '/checkout/success?configuration_order_id=' + encodeURIComponent(orderId),
        cancel_url: PUBLIC_BASE + '/mtg/configurator.html?deck=' + encodeURIComponent(c.deck_id) + '&checkout_cancelled=1',
        'metadata[product_id]': p.id, 'metadata[silo]': 'mtg', 'metadata[configuration_order_id]': orderId,
        'metadata[commerce_version]': 'mtg-80-20-configurator-v1',
        'line_items[0][price_data][currency]': String(c.currency).toLowerCase(),
        'line_items[0][price_data][unit_amount]': priced.total_minor,
        'line_items[0][price_data][product_data][name]': c.name + ' - Configured',
        'line_items[0][price_data][product_data][description]': 'Configured Commander deck with customer-selected finish options.',
        'line_items[0][quantity]': 1
      };
      const session = await stripeCheckout(params, 'dreamledger-mtg-config-' + orderId);
      order.status = 'CHECKOUT_CREATED'; order.stripe_session_id = session.id; order.checkout_url = session.url; order.checkout_created_at = new Date().toISOString();
      fs.writeFileSync(path.join(ORDERS_DIR, orderId + '.json'), JSON.stringify(order, null, 2) + '\n', 'utf8');
      return send(res, 200, { ok: true, order_id: orderId, checkout_url: session.url, pricing: priced, currency: c.currency });
    } catch (err) { return send(res, 400, { error: err.message || 'CHECKOUT_CREATION_FAILED' }); }
  }
  return send(res, 405, { error: 'METHOD_NOT_ALLOWED' });
}
module.exports = { handle };
