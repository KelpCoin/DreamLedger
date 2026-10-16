#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const runtime = fs.readFileSync(path.join(root, 'start.js'), 'utf8');
const compatibility = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const truthOracle = fs.readFileSync(path.join(root, 'routes', 'truthOracleCommerce.js'), 'utf8');
const marketplace = fs.readFileSync(path.join(root, 'routes', 'marketplaceWebhook.js'), 'utf8');
const commercialCell = fs.readFileSync(path.join(root, 'routes', 'commercialCell.js'), 'utf8');
const storefront = fs.readFileSync(path.join(root, '..', 'public', 'server.js'), 'utf8');
const renderConfig = fs.readFileSync(path.join(root, '..', 'render.yaml'), 'utf8');
const storefrontService = renderConfig.split('  - type: pserv')[0];
const privateService = renderConfig.split('  - type: pserv')[1] || '';
const checks = [
  ['canonical Render URL is accepted by the actual start.js runtime', runtime.includes("requestPath==='/webhook'||requestPath==='/api/webhooks/stripe'")],
  ['actual runtime reads the raw request body before dispatch', runtime.includes("if(req.method==='POST'&&(requestPath==='/webhook'||requestPath==='/api/webhooks/stripe')){let raw=''")],
  ['Truth Oracle webhook validates Stripe signature', truthOracle.includes("stripeProof.verifyStripeSignature(raw,signature,process.env.STRIPE_WEBHOOK_SECRET||'')")],
  ['Truth Oracle webhook deduplicates provider event IDs', truthOracle.includes('existing.provider_events && existing.provider_events[event.id]')],
  ['marketplace webhook validates timestamped signatures', marketplace.includes("if (Math.abs(Date.now() / 1000 - Number(t)) > 300)")],
  ['marketplace webhook uses constant-time signature comparison', marketplace.includes('crypto.timingSafeEqual')],
  ['legacy server.js alias remains aligned', compatibility.includes("url==='/api/webhooks/stripe'||url==='/webhook'")],
  ['public storefront forwards signed webhook to private engine', storefront.includes("p==='/api/webhooks/stripe'") && storefront.includes("h['stripe-signature']=req.headers['stripe-signature']") && storefront.includes('return proxyTollToEngine(req,res,p)')],
  ['public storefront does not directly process commercial webhooks', !storefront.includes("require('../BEC-PRIME/routes/commercialCell')") && !storefront.includes('commercialCell.handle')],
  ['commercial APIs are mounted on the private engine', runtime.includes('commercialCellRoute.handle(req,res,requestPath)')],
  ['legacy commercial module cannot act as a second Stripe webhook owner', !commercialCell.includes("path === '/api/webhooks/stripe'") && !commercialCell.includes('async function webhook(req,res)')],
  ['public Render service has no settlement secrets', !/SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|DREAMLEDGER_TOLL_KEY_SECRET|DREAMLEDGER_AGENT_BRIDGE_TOKEN/.test(storefrontService)],
  ['private engine retains operator-managed settlement secrets', ['SUPABASE_SERVICE_ROLE_KEY','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET'].every(key => privateService.includes(key))]
];
const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log((ok ? 'PASS ' : 'FAIL ') + name);
console.log('RENDER_STRIPE_WEBHOOK_ROUTE=' + (failed.length ? 'FAIL' : 'PASS'));
if (failed.length) process.exit(1);
