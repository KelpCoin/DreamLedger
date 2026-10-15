'use strict';

const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

const canonical = fs.readFileSync(path.join(root, 'supabase/functions/stripe-revenue-41104f355d6878cdd6d1f9dc/index.ts'), 'utf8');
const intake = fs.readFileSync(path.join(root, 'supabase/functions/marketplace-diagnostic-input/index.ts'), 'utf8');
const delivery = fs.readFileSync(path.join(root, 'supabase/functions/marketplace-diagnostic-delivery/index.ts'), 'utf8');

const failures = [];
function need(condition, message) { if (!condition) failures.push(message); }

need(/Deno\.env\.get\("STRIPE_WEBHOOK_SIGNING_SECRET"\)/.test(canonical), 'canonical handler must read its endpoint-specific signing secret');
need(!/const STRIPE_WEBHOOK_SIGNING_SECRET=.*STRIPE_WEBHOOK_SECRET/.test(canonical), 'canonical handler must not silently fall back to a possibly unrelated legacy signing secret');
need(/stripe_webhook_signing_secret:Boolean\(STRIPE_WEBHOOK_SIGNING_SECRET\)/.test(canonical), 'health must expose canonical signing-secret presence separately');
need(/constructEventAsync\([\s\S]*?STRIPE_WEBHOOK_SIGNING_SECRET/.test(canonical), 'canonical handler must verify the Stripe signature with the canonical secret');
need(canonical.indexOf('constructEventAsync') < canonical.indexOf('marketplace_settle_stripe_payment'), 'signature verification must precede marketplace settlement');
need((canonical.match(/marketplace_settle_stripe_payment/g) || []).length === 1, 'there must be one canonical settlement RPC call site');
need(/"CMD-DIAG-29":\s*"COMMANDER-DECK-DIAGNOSTIC-001"/.test(intake), 'public Commander SKU must map to the internal fulfillment SKU');
need(/\.eq\("metadata->>sku", internalSku\)/.test(intake), 'fulfillment lookup must use the normalized internal SKU');
need(/session\.livemode !== true \|\| session\.payment_status !== "paid"/.test(intake), 'intake must require a live, settled Stripe session');
need(/session\.livemode/.test(delivery) && /session\.payment_status !== "paid"/.test(delivery), 'delivery must continue to require a live, settled session');

if (failures.length) {
  console.error('COMMANDER_DIAGNOSTIC_WEBHOOK_CONTRACT=FAIL');
  failures.forEach((f) => console.error('FAIL: ' + f));
  process.exit(1);
}
console.log('COMMANDER_DIAGNOSTIC_WEBHOOK_CONTRACT=PASS');
console.log('checks=10');
