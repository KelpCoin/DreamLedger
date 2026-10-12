#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const runtime = fs.readFileSync(path.join(root, 'start.js'), 'utf8');
const compatibility = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const truthOracle = fs.readFileSync(path.join(root, 'routes', 'truthOracleCommerce.js'), 'utf8');
const marketplace = fs.readFileSync(path.join(root, 'routes', 'marketplaceWebhook.js'), 'utf8');
const checks = [
  ['canonical Render URL is accepted by the actual start.js runtime', runtime.includes("requestPath==='/webhook'||requestPath==='/api/webhooks/stripe'")],
  ['actual runtime reads the raw request body before dispatch', runtime.includes("if(req.method==='POST'&&(requestPath==='/webhook'||requestPath==='/api/webhooks/stripe')){let raw=''")],
  ['Truth Oracle webhook validates Stripe signature', truthOracle.includes("stripeProof.verifyStripeSignature(raw,signature,process.env.STRIPE_WEBHOOK_SECRET||'')")],
  ['Truth Oracle webhook deduplicates provider event IDs', truthOracle.includes('existing.provider_events && existing.provider_events[event.id]')],
  ['marketplace webhook validates timestamped signatures', marketplace.includes("if (Math.abs(Date.now() / 1000 - Number(t)) > 300)")],
  ['marketplace webhook uses constant-time signature comparison', marketplace.includes('crypto.timingSafeEqual')],
  ['legacy server.js alias remains aligned', compatibility.includes("url==='/api/webhooks/stripe'||url==='/webhook'")]
];
const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log((ok ? 'PASS ' : 'FAIL ') + name);
console.log('RENDER_STRIPE_WEBHOOK_ROUTE=' + (failed.length ? 'FAIL' : 'PASS'));
if (failed.length) process.exit(1);
