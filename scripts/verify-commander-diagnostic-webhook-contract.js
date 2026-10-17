'use strict';

const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

const canonical = fs.readFileSync(path.join(root, 'supabase/functions/stripe-revenue-41104f355d6878cdd6d1f9dc/index.ts'), 'utf8');
const intake = fs.readFileSync(path.join(root, 'supabase/functions/marketplace-diagnostic-input/index.ts'), 'utf8');
const delivery = fs.readFileSync(path.join(root, 'supabase/functions/marketplace-diagnostic-delivery/index.ts'), 'utf8');

const failures = [];
function need(condition, message) { if (!condition) failures.push(message); }

need(canonical.includes('Deno.env.get("STRIPE_WEBHOOK_SIGNING_SECRET")'), 'canonical handler must read the endpoint-specific signing secret');
need(!canonical.includes('Deno.env.get("STRIPE_WEBHOOK_SIGNING_SECRET")||Deno.env.get("STRIPE_WEBHOOK_SECRET")'), 'canonical handler must not silently fall back to a possibly unrelated legacy signing secret');
need(canonical.includes('stripe_webhook_signing_secret:Boolean(STRIPE_WEBHOOK_SIGNING_SECRET)'), 'health must expose canonical signing-secret presence separately');
need(canonical.includes('constructEventAsync') && canonical.includes('STRIPE_WEBHOOK_SIGNING_SECRET'), 'canonical handler must verify the Stripe signature with the canonical secret');
need(canonical.indexOf('constructEventAsync') < canonical.indexOf('marketplace_settle_stripe_payment'), 'signature verification must precede marketplace settlement');
need((canonical.match(/marketplace_settle_stripe_payment/g) || []).length === 1, 'there must be one canonical settlement RPC call site');
need(intake.includes('"CMD-DIAG-29": "COMMANDER-DECK-DIAGNOSTIC-001"'), 'public Commander SKU must map to the internal fulfillment SKU');
need(intake.includes('.eq("metadata->>sku", internalSku)'), 'fulfillment lookup must use the normalized internal SKU');
need(intake.includes('session.livemode !== true || session.payment_status !== "paid"'), 'intake must require a live, settled Stripe session');
need(delivery.includes('session.livemode') && delivery.includes('session.payment_status!=="paid"'), 'delivery must continue to require a live, settled session');
need(!canonical.includes('WEBHOOK_QUARANTINED'), 'canonical settlement owner must not be the quarantined v2 handler');

if (failures.length) {
  console.error('COMMANDER_DIAGNOSTIC_WEBHOOK_CONTRACT=FAIL');
  failures.forEach((f) => console.error('FAIL: ' + f));
  process.exit(1);
}
console.log('COMMANDER_DIAGNOSTIC_WEBHOOK_CONTRACT=PASS');
console.log('checks=11');
