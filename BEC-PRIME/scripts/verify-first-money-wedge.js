'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PRODUCT = path.join(ROOT, 'catalog', 'products', 'AGENTIC-COMMERCE-READINESS-001.json');
const SERVER = path.join(ROOT, 'server.js');
const PROOF = path.join(ROOT, 'PROOF-FIRST-MONEY-WEDGE.json');

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

if (!fs.existsSync(PRODUCT)) fail('revenue wedge product is missing');
if (!fs.existsSync(SERVER)) fail('server.js is missing');

if (!process.exitCode) {
  const product = JSON.parse(fs.readFileSync(PRODUCT, 'utf8'));
  const server = fs.readFileSync(SERVER, 'utf8');
  const checks = {
    product_id: product.id,
    general_commerce_silo: product.silo === 'commerce',
    published: product.status === 'published',
    price_nzd_49: product.price === 4900 && product.currency === 'nzd',
    approval_off: product.commercial_truth?.approval_required === false,
    checkout_payment: product.checkout?.mode === 'payment',
    stripe_checkout_route: server.includes("url==='/api/checkout/create'") && server.includes("stripeRequest('checkout/sessions'") ,
    stripe_webhook_route: server.includes("url==='/webhook'") && server.includes("checkout.session.completed"),
    first_payment_proof_hook: server.includes('FIRST_PAYMENT_PROOF'),
    silo_isolation_metadata: product.silo_policy?.mtg_isolation === true && product.silo_policy?.dreamiez_isolation === true
  };
  const pass = Object.values(checks).every(Boolean);
  const proof = {
    type: 'dreamledger-first-money-wedge-verification',
    status: pass ? 'PASS' : 'FAIL',
    generated_at: new Date().toISOString(),
    product_id: product.id,
    checks,
    payment_path: 'catalog product -> /api/checkout/create -> Stripe Checkout -> /webhook -> transaction proof -> FIRST_PAYMENT_PROOF.json',
    commercial_truth: 'No payment is claimed until Stripe webhook evidence exists.'
  };
  fs.writeFileSync(PROOF, JSON.stringify(proof, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(proof, null, 2));
  if (!pass) process.exitCode = 1;
}
