'use strict';
// BECK: fail the Vercel build if the existing public portfolio routes are not shipped.
// No external calls, customer data, spend, or payment mutations.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const mustExist = [
  'index.html','catalog.json','avatar.html','billboard.html','b2b.html','marketplace.html',
  'agent-bridge.html','truth-oracle.html','tools/free.html','register/index.html',
  'agentic-commerce-remediation-blueprint.html','auctions.html','trust/index.html',
  'mtg/index.html','go/index.html'
];
for (const name of mustExist) {
  const file = path.join(root,'public',name);
  if (!fs.statSync(file,{throwIfNoEntry:false})?.isFile())
    throw new Error('PUBLIC_RELEASE_FILE_MISSING: '+name);
}
const home=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
if (!home.includes('DreamLedger') || home.includes('/buy/COMMANDER-DECK-DIAGNOSTIC-001'))
  throw new Error('PUBLIC_HOME_STALE_OR_HELD_CHECKOUT_BYPASS');
const catalog=JSON.parse(fs.readFileSync(path.join(root,'public/catalog.json'),'utf8'));
if (catalog.schema !== 'dreamledger/public-catalogue/v1' || !Array.isArray(catalog.products))
  throw new Error('PUBLIC_CATALOG_SCHEMA_INVALID');
const diagnostic=catalog.products.find(p=>p.id==='COMMANDER-DECK-DIAGNOSTIC-001');
if (!diagnostic || diagnostic.checkout_available !== false)
  throw new Error('HELD_DIAGNOSTIC_MUST_NOT_BE_CHECKOUT_ENABLED');
const vercel=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));
for (const source of ['/b2b','/b2b/']) {
  if (!vercel.rewrites?.some(rule=>rule.source===source&&rule.destination==='/b2b.html'))
    throw new Error('PUBLIC_B2B_ROUTE_REWRITE_MISSING: '+source);
}
for (const source of ['/marketplace','/marketplace/']) {
  if (!vercel.rewrites?.some(rule=>rule.source===source&&rule.destination==='/marketplace.html'))
    throw new Error('PUBLIC_MARKETPLACE_ROUTE_REWRITE_MISSING: '+source);
}
// Golden-master safety gate: published deck listings cannot expose unreserved payment.
const mtgCatalog=JSON.parse(fs.readFileSync(path.join(root,'public/data/mtg-catalog.json'),'utf8'));
const edh=(mtgCatalog.products||[]).find(p=>p.id==='EDH_0001');
const globalEdh=catalog.products.find(p=>p.id==='EDH_0001');
if(!edh||!globalEdh||edh.silo!=='mtg'||edh.price!==globalEdh.price||
   edh.price!==230||edh.inventory!==0||edh.checkout_available!==false||
   globalEdh.checkout_available!==false||edh.checkout_url!==null)
  throw new Error('MTG_MASTER_UNVERIFIED_STOCK_OR_PRICE');
const mtgHtml=fs.readFileSync(path.join(root,'public/mtg/index.html'),'utf8');
const detail=fs.readFileSync(path.join(root,'public/mtg/edh-0001.html'),'utf8');
const mtgRuntime=fs.readFileSync(path.join(root,'public/assets/mtg-community.js'),'utf8');
if(!mtgRuntime.includes('There is no online checkout')||!mtgHtml.includes('/assets/mtg-community.js')||!detail.includes('checkout held')||
   mtgHtml.includes('buy.stripe.com')||detail.includes('buy.stripe.com')||
   mtgHtml.includes('var FALLBACK')||mtgHtml.split('</html>').length!==2)
  throw new Error('MTG_MASTER_UNSAFE_PAYMENT_OR_MALFORMED_HTML');
if(!home.includes('href="/mtg/"'))throw new Error('MTG_HOME_ENTRY_MISSING');
const billboardHtml=fs.readFileSync(path.join(root,'public/billboard.html'),'utf8');
if(!billboardHtml.includes('Your HTTPS destination URL is optional'))
  throw new Error('BILLBOARD_OPTIONAL_URL_COPY_REGRESSION');
if(!billboardHtml.includes('Paid placement checkout is temporarily held') || billboardHtml.includes('https://buy.stripe.com/'))
  throw new Error('HELD_BILLBOARD_DIRECT_PAYMENT_EXPOSURE');
console.log('BECK_PUBLIC_RELEASE_FILES_PASS: '+mustExist.length+' routes, '+catalog.products.length+' catalog entries; B2B aliases verified; no sale asserted');


/* Study handover integration: enforce the same source-of-truth storefront contract on every Vercel build. */
require('./test_beck_vercel_contract.cjs');

require('./test-beck-mtg-master-release.cjs');

// Gate: never treat Stripe redirects as payment or entitlements.
require('node:child_process').execFileSync(process.execPath,['scripts/test-beck-checkout-status.mjs'],{stdio:'inherit'});

require('node:child_process').execFileSync(process.execPath,['scripts/test-beck-supabase-checkout.cjs'],{stdio:'inherit'});
