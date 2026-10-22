'use strict';
// Review-only static contract: proves the paid intake and worker agree on
// fulfillment-request-owned upload paths. This makes no network calls.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const intake = fs.readFileSync(path.join(root, 'supabase/functions/quote-intake/index.ts'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'supabase/functions/quote-fulfillment/index.ts'), 'utf8');

assert.match(intake, /const path=`quote-inputs\/\$\{fr\.id\}\/\$\{crypto\.randomUUID\(\)\}-\$\{original\}`/);
assert.match(intake, /p\.startsWith\(`quote-inputs\/\$\{fr\.id\}\/`\)/);
assert.match(intake, /const dir=`quote-inputs\/\$\{fr\.id\}`/);
assert.doesNotMatch(intake, /quote-inputs\/\$\{ctx\.order\.id\}/);
assert.match(worker, /path\.startsWith\("quote-inputs\/"\+id\+"\/"\)/);
assert.match(intake, /session\.payment_status!=="paid"/);
assert.match(intake, /session\.payment_link!==PAYMENT_LINK/);
assert.match(intake, /if\(!ent\)throw new Error\("ENTITLEMENT_PENDING"\)/);
assert.match(worker, /\.eq\("sku_id",SKU\)/);
assert.match(worker, /revenue_claimed:false/);
console.log('QUOTE_UPLOAD_FULFILLMENT_IDENTITY=PASS; PAYMENT_AND_DELIVERY_NOT_PROVEN');
