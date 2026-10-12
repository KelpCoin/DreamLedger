#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const checks = [
  ['configured Render path reaches the shared handler', /req\.method==='POST'&&\(url==='\/api\/webhooks\/stripe'\|\|url==='\/webhook'\)\)return webhook\(req,res\)/.test(source)],
  ['handler verifies Stripe signature', /verifyStripeSignature\(raw,req\.headers\[['"]stripe-signature['"]\]\|\|['"]['"]\)/.test(source)],
  ['handler rejects stale signatures', /if\(age>300\)throw new Error\(['"]Expired Stripe signature['"]\)/.test(source)],
  ['handler compares signatures in constant time', /crypto\.timingSafeEqual\(a,b\)/.test(source)],
  ['handler requires paid checkout', /session\.payment_status!=='paid'/.test(source)],
  ['handler checks transaction idempotency', /fs\.existsSync\(txFile\)/.test(source)],
  ['handler writes payment and fulfillment ledger evidence', /revenueLedger\.recordPayment/.test(source) && /revenueLedger\.recordFulfillment/.test(source)]
];
const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log((ok ? 'PASS ' : 'FAIL ') + name);
console.log('RENDER_STRIPE_WEBHOOK_ROUTE=' + (failed.length ? 'FAIL' : 'PASS'));
if (failed.length) process.exit(1);
