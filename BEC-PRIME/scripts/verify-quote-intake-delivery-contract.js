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
// Reject old acceptance of extra files and out-of-range sizes before any signed URLs are issued.
assert.match(intake, /const supplied=Array\.isArray\(body\.files\)\?body\.files:\[\]/);
assert.doesNotMatch(intake, /body\.files\.slice\(0,MAX_FILES\)/);
assert.match(intake, /Number\.isSafeInteger\(bytes\)\|\|bytes<=0\|\|bytes>MAX_BYTES/);
assert.match(intake, /if\(!\["pdf","csv","json","md"\]\.includes\(ext\)\)return out\(\{error:"UNSUPPORTED_FILE_TYPE"/);
assert.match(intake, /if\(fr\.status==="fulfilled"\|\|fr\.canonical_state==="FULFILLED"\)return out\(\{error:"ALREADY_FULFILLED"\},409\)/);
assert.match(intake, /const files=Array\.isArray\(body\.files\)\?body\.files:\[\]/);
console.log('QUOTE_UPLOAD_FULFILLMENT_IDENTITY=PASS; PAYMENT_AND_DELIVERY_NOT_PROVEN');
