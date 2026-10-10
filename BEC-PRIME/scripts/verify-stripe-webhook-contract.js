'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const webhook = fs.readFileSync(path.join(root, 'routes', 'mvpRoutes.js'), 'utf8');
const preload = fs.readFileSync(path.join(root, 'lib', 'commercePaymentContractPreload.js'), 'utf8');
const canonicalWebhook = fs.readFileSync(path.join(root, '..', 'supabase', 'functions', 'stripe-revenue-41104f355d6878cdd6d1f9dc', 'index.ts'), 'utf8');
const quoteIntake = fs.readFileSync(path.join(root, '..', 'supabase', 'functions', 'quote-intake', 'index.ts'), 'utf8');
const idempotencyMigration = fs.readFileSync(path.join(root, '..', 'supabase', 'migrations', '20261010120100_stripe_webhook_claim_and_order_idempotency.sql'), 'utf8');
const legacyQuoteRoute = fs.readFileSync(path.join(root, '..', 'public', 'buy', 'quote_compare_49', 'index.html'), 'utf8');

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
need(canonicalWebhook.includes('rpc("claim_stripe_webhook_event"'), 'canonical Edge webhook must atomically claim each Stripe event before side effects');
need(canonicalWebhook.includes('metadata.dreamledger_sku') && canonicalWebhook.includes('metadata.product_sku'), 'canonical Edge webhook must resolve legacy and canonical SKU metadata keys');
need(canonicalWebhook.includes('eq("stripe_checkout_session_id",checkoutSessionId)'), 'canonical Edge webhook must deduplicate orders by Checkout Session ID');
need(canonicalWebhook.includes('amount_nzd:amountNzd'), 'canonical Edge webhook must preserve cents instead of rounding NZD to whole dollars');
need(canonicalWebhook.includes('checkout.session.async_payment_succeeded'), 'canonical Edge webhook must process delayed-payment settlement events');
need(canonicalWebhook.includes('session.livemode!==true'), 'canonical Edge webhook must reject test-mode sessions from live revenue');
need(quoteIntake.includes('STRIPE_API_KEY?new Stripe(STRIPE_API_KEY):null') && quoteIntake.includes('if(!stripe)throw new Error("SERVICE_NOT_CONFIGURED")'), 'quote intake must not crash at module initialization when Stripe credentials are absent');
need(legacyQuoteRoute.includes('location.replace("/quote-comparison/")') && !legacyQuoteRoute.includes('buy.stripe.com'), 'legacy quote buy route must point to the free worksheet, not the retired payment link');
need(idempotencyMigration.includes('revenue_orders_checkout_session_uidx') && idempotencyMigration.includes('revenue_entitlements_order_id_uidx') && idempotencyMigration.includes('fulfillment_requests_entitlement_id_uidx'), 'database migration must enforce unique order, entitlement and fulfillment keys');
need(idempotencyMigration.includes('processing_started_at < now() - interval \'5 minutes\''), 'database claim must recover abandoned event processing after a bounded lease');

if (failures.length) {
  console.error('STRIPE_WEBHOOK_CONTRACT=FAIL');
  failures.forEach((x) => console.error('FAIL: ' + x));
  process.exit(1);
}

console.log('STRIPE_WEBHOOK_CONTRACT=PASS');
console.log('checks=20');
