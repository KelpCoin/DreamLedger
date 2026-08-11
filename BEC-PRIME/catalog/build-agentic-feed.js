'use strict';

const fs = require('fs');
const path = require('path');

const source = path.join(__dirname, 'evergreen-products.json');
const out = path.join(__dirname, '..', 'compiled', 'website', 'agentic', 'catalog.json');
const data = JSON.parse(fs.readFileSync(source, 'utf8'));

const feed = {
  schema: 'https://dreamledger.org/schemas/agentic-commerce/v1',
  merchant: { name: 'DreamLedger / HappyHomarid Master Sellers', region: 'NZ-first', currency: 'NZD' },
  payment: { rail: 'Stripe Checkout', cryptocurrency: false },
  activation: 'human-approval-required',
  entitlement: 'server-verified',
  fulfilment: 'protected-goods-or-governed-service',
  products: data.products.map(p => ({
    id: p.product_id,
    title: p.title,
    category: p.category,
    buyer: p.buyer,
    price_nzd: p.price_nzd,
    status: p.status,
    channel: p.channel,
    agentic_ready: p.agentic_ready,
    discoverable: true,
    machine_readable: true,
    checkout: 'https://dreamledger.org/shop/',
    entitlement: p.entitlement,
    silo: p.silo,
    activation_policy: 'candidate-until-approved'
  }))
};

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(feed, null, 2) + '\n');
console.log(JSON.stringify({ status: 'PASS', output: out, products: feed.products.length }, null, 2));
