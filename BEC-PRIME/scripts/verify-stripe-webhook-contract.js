'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const webhook = fs.readFileSync(path.join(root, 'routes', 'mvpRoutes.js'), 'utf8');
const preload = fs.readFileSync(path.join(root, 'lib', 'commercePaymentContractPreload.js'), 'utf8');

const failures = [];
function need(condition, message) { if (!condition) failures.push(message); }

need(/stripeEventAlreadyRecorded\(event\.id\)/.test(webhook), 'webhook must deduplicate by Stripe event.id before processing');
need(/const accountId = cleanQuery\(session\.metadata\?\.account_id\) \|\| null/.test(webhook), 'webhook account_id must be nullable for guest purchases');
need(/const p = product\(productId\)/.test(webhook), 'post-payment webhook must use product(), not checkoutableProduct()');
need(/p\.status !== 'published'/.test(webhook), 'webhook must require published product status');
need(/sessionCurrency !== productCurrency/.test(webhook), 'webhook must validate currency against canonical product currency');
need(/sessionAmount !== productAmount/.test(webhook), 'webhook must validate amount against canonical product price');
need(/eventId: 'stripe_' \+ event\.id/.test(webhook), 'ledger evidence must persist Stripe event.id as the idempotency key');
need(/payment_intent_data\[metadata\]\[product_sku\]/.test(webhook), 'checkout producer must propagate product_sku to PaymentIntent metadata');
need(/payment_intent_data\[metadata\]\[product_id\]/.test(preload), 'central checkout preload must propagate product_id to PaymentIntent metadata');
need(/payment_intent_data\[metadata\]\[product_sku\]/.test(preload), 'central checkout preload must propagate product_sku to PaymentIntent metadata');

if (failures.length) {
  console.error('STRIPE_WEBHOOK_CONTRACT=FAIL');
  failures.forEach((x) => console.error('FAIL: ' + x));
  process.exit(1);
}

console.log('STRIPE_WEBHOOK_CONTRACT=PASS');
console.log('checks=10');
