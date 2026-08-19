'use strict';

// Reconciles the public homepage hero with the single operator-approved offer.
// This script is deliberately local-only: it changes compiled public HTML and never
// creates, approves, or records a payment.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const APPROVED = path.join(ROOT, 'catalog', 'offers', 'approved.json');
const INDEX = path.join(ROOT, 'compiled', 'website', 'index.html');

const approved = JSON.parse(fs.readFileSync(APPROVED, 'utf8'));
const offers = Array.isArray(approved.approved) ? approved.approved : [];
if (offers.length !== 1) throw new Error(`FEATURED_OFFER_GATE_FAILED: expected exactly 1 approved offer, found ${offers.length}`);

const offer = offers[0];
if (offer.silo !== 'dreamledger') throw new Error('FEATURED_OFFER_GATE_FAILED: approved offer is not DreamLedger silo');
if (offer.currency !== 'NZD' || Number(offer.price) !== 29) throw new Error(`FEATURED_OFFER_GATE_FAILED: expected NZD 29, got ${offer.currency} ${offer.price}`);

let html = fs.readFileSync(INDEX, 'utf8');
const oldBlock = /<div class="featured"><div class="eyebrow">Start here<\/div><h2>Agentic Commerce Readiness Audit<\/h2><p>Audit catalog structure, pricing, inventory, checkout readiness, policies and machine-readable commerce surfaces, then get the highest-value next actions\.<\/p><div class="featured-price">NZD 49 <small>one-time<\/small><\/div><button class="btn gold" id="featured-buy" type="button">Buy the audit<\/button><div class="trust-row"><div class="trust"><b>Approved<\/b><span>Catalog gated<\/span><\/div><div class="trust"><b>Live price<\/b><span>Server checked<\/span><\/div><div class="trust"><b>Proof<\/b><span>Webhook recorded<\/span><\/div><\/div><\/div>/;
const replacement = `<div class="featured"><div class="eyebrow">Start here</div><h2>${offer.name}</h2><p>${offer.output}</p><div class="featured-price">NZD ${Number(offer.price).toFixed(0)} <small>one-time</small></div><button class="btn gold" id="featured-buy" type="button">Buy the diagnostic</button><div class="trust-row"><div class="trust"><b>Approved</b><span>Operator approved</span></div><div class="trust"><b>NZD 29</b><span>Fixed price</span></div><div class="trust"><b>Proof</b><span>Settlement recorded</span></div></div></div>`;

if (!oldBlock.test(html)) throw new Error('FEATURED_OFFER_GATE_FAILED: stale featured offer block not found');
html = html.replace(oldBlock, replacement);
html = html.replace("products.find(p=>p.id==='AGENTIC-COMMERCE-READINESS-001')", `products.find(p=>p.id==='${offer.product_id}')`);

fs.writeFileSync(INDEX, html, 'utf8');

const verify = fs.readFileSync(INDEX, 'utf8');
if (!verify.includes(`>${offer.name}</h2>`)) throw new Error('FEATURED_OFFER_GATE_FAILED: approved offer name missing from compiled homepage');
if (!verify.includes(`NZD ${Number(offer.price).toFixed(0)} <small>one-time</small>`)) throw new Error('FEATURED_OFFER_GATE_FAILED: approved price missing from compiled homepage');
if (verify.includes('Agentic Commerce Readiness Audit') || verify.includes('NZD 49')) throw new Error('FEATURED_OFFER_GATE_FAILED: stale 49-dollar hero remains');

console.log(JSON.stringify({status:'PASS', featured_offer_id:offer.offer_id, product_id:offer.product_id, price_nzd:Number(offer.price), compiled_index:INDEX}, null, 2));
