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
// Buyer-journey guard: real EDH inventory must point to the existing guarded link.
const mtgCatalog=JSON.parse(fs.readFileSync(path.join(root,'public/data/mtg-catalog.json'),'utf8'));
const edh=(mtgCatalog.products||[]).find(p=>p.id==='EDH_0001');
const edhLink='https://buy.stripe.com/14A3cvea1dSd1DV5oEdwc1J';
if(!edh || edh.price!==400 || edh.currency!=='NZD' || edh.inventory!==1 ||
   edh.checkout_available!==true || edh.checkout_url!==edhLink || edh.silo!=='mtg')
  throw new Error('EDH_0001_GUARDED_CHECKOUT_INVALID');
const mtgHtml=fs.readFileSync(path.join(root,'public/mtg/index.html'),'utf8');
if(!mtgHtml.includes('id="edh-0001-direct-checkout"') || !mtgHtml.includes(edhLink))
  throw new Error('EDH_0001_DIRECT_CHECKOUT_NOT_EXPOSED');
if(!home.includes('View deck &amp; secure checkout') || !home.includes('href="/mtg/#decks"'))
  throw new Error('MTG_HOME_PURCHASE_ENTRY_NOT_EXPOSED');
const billboardHtml=fs.readFileSync(path.join(root,'public/billboard.html'),'utf8');
if(!billboardHtml.includes('Your HTTPS destination URL is optional'))
  throw new Error('BILLBOARD_OPTIONAL_URL_COPY_REGRESSION');
console.log('BECK_PUBLIC_RELEASE_FILES_PASS: '+mustExist.length+' routes, '+catalog.products.length+' catalog entries; B2B aliases verified; no sale asserted');


/* Study handover integration: enforce the same source-of-truth storefront contract on every Vercel build. */
require('./test_beck_vercel_contract.cjs');
