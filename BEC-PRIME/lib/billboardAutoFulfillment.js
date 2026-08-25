'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const revenueLedger = require('./revenueLedger');

const ROOT = process.env.BILLBOARD_DATA_DIR || '/var/data/billboard';
const BASE = (process.env.PUBLIC_BASE_URL || 'https://dreamledger.org').replace(/\/$/, '');
const MAX_BYTES = 5 * 1024 * 1024;
const MARKETS = { GLOBAL: 'Global', NZ: 'New Zealand', AU: 'Australia', ZA: 'South Africa', AMERICAS: 'Americas', EUROPE: 'Europe' };
const FOUNDING = { w: 100, h: 100, price: 5000, sku: 'BILLBOARD-SMALL' };
const BAD = /\b(?:n[i1]gg(?:er|a)|fagg(?:ot|ots)|kike|chink|spic|coon|wetback|retard(?:ed)?|kill\s+(?:all|the)|white\s+power|heil\s+hitler|gas\s+the|death\s+to)\b/i;

function mkdir(p) { fs.mkdirSync(p, { recursive: true }); }
function file(market) { return path.join(ROOT, 'markets', market, 'billboard.json'); }
function media(id) { return path.join(ROOT, 'media', id); }
function read(file, fallback) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } }
function write(file, value) { mkdir(path.dirname(file)); fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8'); }
function load(market) { return read(file(market), { version: 2, market, canvas: { w: 1000, h: 1000 }, ads: [] }); }
function save(market, state) { write(file(market), state); }
function clean(value, max) { return String(value || '').trim().slice(0, max); }
function blockedHost(host) {
  const h = String(host || '').toLowerCase();
  if (!h || h === 'localhost' || h.endsWith('.localhost') || h === 'metadata.google.internal') return true;
  if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true;
  return false;
}
function validHttpUrl(value) {
  let u;
  try { u = new URL(value); } catch { return null; }
  if (!/^https?:$/.test(u.protocol) || blockedHost(u.hostname)) return null;
  return u;
}
function customFields(session) {
  const out = {};
  for (const field of Array.isArray(session?.custom_fields) ? session.custom_fields : []) {
    if (field?.key) out[field.key] = String(field?.text?.value || field?.numeric?.value || field?.dropdown?.value || '').trim();
  }
  return out;
}
function position(state) {
  for (let y = 0; y <= 900; y += 100) for (let x = 0; x <= 900; x += 100) {
    if (!state.ads.some(a => a.status !== 'REJECTED' && x < a.x + a.w && x + 100 > a.x && y < a.y + a.h && y + 100 > a.y)) return { x, y };
  }
  return null;
}
function remaining(state) {
  const used = state.ads.filter(a => a.status !== 'REJECTED').reduce((n, a) => n + Number(a.w || 0) * Number(a.h || 0), 0);
  return Math.max(0, Math.floor((1000000 - used) / 10000));
}
async function fetchImage(url) {
  const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'DreamLedger-Billboard-Fulfillment/2.0' } });
  if (!response.ok) throw new Error('Image URL returned HTTP ' + response.status);
  const type = String(response.headers.get('content-type') || '').split(';')[0].toLowerCase();
  if (!/^image\/(png|jpeg|webp|gif)$/.test(type)) throw new Error('Image URL must return PNG, JPEG, WEBP or GIF');
  const length = Number(response.headers.get('content-length') || 0);
  if (length > MAX_BYTES) throw new Error('Image exceeds 5MB');
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > MAX_BYTES) throw new Error('Image exceeds 5MB');
  return { buffer, type };
}
async function fulfill(session, eventId) {
  if (session?.payment_status !== 'paid') return { handled: false, reason: 'payment_not_paid' };
  if (session?.metadata?.offer_id !== 'DREAMLEDGER-BILLBOARD-FOUNDING-001') return { handled: false };
  const market = String(session.metadata?.market || 'NZ').toUpperCase();
  if (!MARKETS[market]) throw new Error('Invalid billboard market');
  if (Number(session.amount_total) !== FOUNDING.price || String(session.currency || '').toLowerCase() !== 'nzd') throw new Error('Billboard payment amount/currency mismatch');

  const state = load(market);
  const existing = state.ads.find(a => a.transaction_id === session.id);
  if (existing?.status === 'PUBLISHED') return { handled: true, idempotent: true, ad_id: existing.id, fulfillment_id: existing.fulfillment_id };
  const p = position(state);
  if (!p) throw new Error('FOUNDING_BILLBOARD_SOLD_OUT');

  const fields = customFields(session);
  const imageUrl = clean(fields.tile_image_url, 255);
  const destinationUrl = clean(fields.destination_url, 255);
  const altText = clean(fields.tile_alt_text, 120);
  if (!validHttpUrl(imageUrl) || !validHttpUrl(destinationUrl)) throw new Error('Billboard image and destination must be public HTTP(S) URLs');
  if (!altText || BAD.test(altText) || BAD.test(destinationUrl)) throw new Error('Billboard content failed automatic moderation');

  const image = await fetchImage(imageUrl);
  const id = 'ad_' + crypto.randomUUID();
  const ext = image.type === 'image/jpeg' ? '.jpg' : image.type === 'image/png' ? '.png' : image.type === 'image/webp' ? '.webp' : '.gif';
  mkdir(path.dirname(media(id)));
  fs.writeFileSync(media(id), image.buffer, { flag: 'wx' });

  const fulfillment = revenueLedger.createFulfillment({ transactionId: session.id, productId: FOUNDING.sku, offerId: 'DREAMLEDGER-BILLBOARD-FOUNDING-001', silo: 'dreamledger', amountMinor: Number(session.amount_total), currency: 'NZD', customerEmail: session.customer_details?.email || null });
  revenueLedger.recordPayment({ eventId: eventId || 'billboard:' + session.id + ':payment', transactionId: session.id, amountMinor: Number(session.amount_total), currency: 'nzd', productId: FOUNDING.sku, offerId: 'DREAMLEDGER-BILLBOARD-FOUNDING-001', silo: 'dreamledger' });
  revenueLedger.recordFulfillment({ eventId: session.id + ':fulfillment', transactionId: session.id, amountMinor: Number(session.amount_total), currency: 'NZD', fulfillmentId: fulfillment.fulfillment.fulfillment_id, productId: FOUNDING.sku, offerId: 'DREAMLEDGER-BILLBOARD-FOUNDING-001', silo: 'dreamledger' });

  const ad = { id, market, sku: FOUNDING.sku, status: 'PUBLISHED', payment_status: 'paid', human_review: 'AUTO_PASS', fulfillment_recorded: true, fulfillment_id: fulfillment.fulfillment.fulfillment_id, transaction_id: session.id, amount_total_minor: Number(session.amount_total), size: 'small', size_label: 'Founding Tile', w: 100, h: 100, x: p.x, y: p.y, title: altText, name: session.customer_details?.name || '', email: session.customer_details?.email || '', link: destinationUrl, source_image_url: imageUrl, mime: image.type, ext, created_at: new Date().toISOString(), paid_at: new Date().toISOString(), fulfilled_at: new Date().toISOString(), published_at: new Date().toISOString(), scarcity_bucket: 'FOUNDING_100', delivery_url: BASE + '/billboard/media/' + id, proof_url: BASE + '/api/billboard/order/' + market.toLowerCase() + '/' + id };
  state.ads.push(ad);
  save(market, state);
  return { handled: true, idempotent: false, ad_id: id, market, position: p, founding_positions_remaining: remaining(state), delivery_url: ad.delivery_url, fulfillment_id: ad.fulfillment_id };
}
module.exports = { fulfill };
