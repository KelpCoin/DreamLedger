'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FEATURED = path.join(ROOT, 'catalog', 'featured-offer.json');
const PRODUCTS = path.join(ROOT, 'catalog', 'products');
const INDEX = path.join(ROOT, 'compiled', 'website', 'index.html');

const featured = JSON.parse(fs.readFileSync(FEATURED, 'utf8'));
if (featured.currency !== 'NZD') throw new Error(`FEATURED_OFFER_GATE_FAILED: unsupported currency ${featured.currency}`);
if (!Number.isFinite(Number(featured.price)) || Number(featured.price) <= 0) throw new Error('FEATURED_OFFER_GATE_FAILED: invalid featured price');
if (!featured.offer_id || !featured.product_id || !featured.payment_link_url) throw new Error('FEATURED_OFFER_GATE_FAILED: incomplete featured offer');
if (featured.payment_link_status !== 'ACTIVE_LIVEMODE') throw new Error(`FEATURED_OFFER_GATE_FAILED: payment link is not ACTIVE_LIVEMODE: ${featured.payment_link_status}`);

const productPath = path.join(PRODUCTS, `${featured.product_id}.json`);
if (!fs.existsSync(productPath)) throw new Error(`FEATURED_OFFER_GATE_FAILED: product missing: ${featured.product_id}`);
const product = JSON.parse(fs.readFileSync(productPath, 'utf8'));
if (product.id !== featured.product_id) throw new Error('FEATURED_OFFER_GATE_FAILED: product identity mismatch');
if (product.silo !== featured.silo) throw new Error('FEATURED_OFFER_GATE_FAILED: silo mismatch');
if (Number(product.price) !== Number(featured.price)) throw new Error(`FEATURED_OFFER_GATE_FAILED: product price ${product.price} != featured price ${featured.price}`);
if (product.currency !== String(featured.currency).toLowerCase()) throw new Error('FEATURED_OFFER_GATE_FAILED: product currency mismatch');
if (product.commercial_truth && product.commercial_truth.payment_link !== featured.payment_link_url) throw new Error('FEATURED_OFFER_GATE_FAILED: product payment link mismatch');

let html = fs.readFileSync(INDEX, 'utf8');
const startMarker = '<div class="featured"><div class="eyebrow">Start here</div>';
const endMarker = '</div></aside></section>';
const start = html.indexOf(startMarker);
const end = start >= 0 ? html.indexOf(endMarker, start) : -1;
if (start < 0 || end < 0) throw new Error('FEATURED_OFFER_GATE_FAILED: homepage featured block boundaries not found');

const description = String(product.description || 'A focused written Commander deck diagnostic.').replace(/[&<>\"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
const name = String(featured.name).replace(/[&<>\"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
const price = Number(featured.price).toFixed(0);
const replacement = `<div class="featured"><div class="eyebrow">Start here</div><h2>${name}</h2><p>${description}</p><div class="featured-price">NZD ${price} <small>one-time</small></div><a class="btn gold" id="featured-buy" href="${featured.payment_link_url}" target="_blank" rel="noopener">Buy the diagnostic</a><div class="trust-row"><div class="trust"><b>Approved</b><span>Operator approved</span></div><div class="trust"><b>NZD ${price}</b><span>Fixed price</span></div><div class="trust"><b>Live checkout</b><span>Stripe livemode</span></div></div></div>`;

html = html.slice(0, start) + replacement + html.slice(end);
fs.writeFileSync(INDEX, html, 'utf8');

const verify = fs.readFileSync(INDEX, 'utf8');
if (!verify.includes(`>${name}</h2>`)) throw new Error('FEATURED_OFFER_GATE_FAILED: featured name missing');
if (!verify.includes(`NZD ${price} <small>one-time</small>`)) throw new Error('FEATURED_OFFER_GATE_FAILED: featured price missing');
if (!verify.includes(`href="${featured.payment_link_url}"`)) throw new Error('FEATURED_OFFER_GATE_FAILED: featured payment link missing');

console.log(JSON.stringify({
  status: 'PASS',
  featured_offer_id: featured.offer_id,
  product_id: featured.product_id,
  silo: featured.silo,
  price_nzd: Number(featured.price),
  payment_link_status: featured.payment_link_status,
  compiled_index: INDEX
}, null, 2));
