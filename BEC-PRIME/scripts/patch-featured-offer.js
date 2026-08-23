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
if (Number(product.price) !== Number(featured.price)) throw new Error(`FEATURED_OFFER_GATE_FAILED: product price ${product.price} != featured ${featured.price}`);
if (product.currency !== String(featured.currency).toLowerCase()) throw new Error('FEATURED_OFFER_GATE_FAILED: product currency mismatch');
if (product.commercial_truth && product.commercial_truth.payment_link !== featured.payment_link_url) throw new Error('FEATURED_OFFER_GATE_FAILED: product payment link mismatch');

const html = fs.readFileSync(INDEX, 'utf8');
const marker = `content="${featured.product_id}"`;
if (!html.includes(marker)) throw new Error('FEATURED_OFFER_GATE_FAILED: canonical product marker missing from catalog front door');
if (!html.toLowerCase().includes('digital goods')) throw new Error('FEATURED_OFFER_GATE_FAILED: digital goods rail missing');
if (!html.toLowerCase().includes('mtg')) throw new Error('FEATURED_OFFER_GATE_FAILED: MTG lane missing');

console.log(JSON.stringify({
  status: 'PASS',
  featured_offer_id: featured.offer_id,
  product_id: featured.product_id,
  sku: featured.sku,
  silo: featured.silo,
  price_nzd: Number(featured.price),
  payment_link_status: featured.payment_link_status,
  placement: 'digital-goods-rail + MTG silo'
}, null, 2));
