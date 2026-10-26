'use strict';
// BECK: fail the Vercel build if the existing public portfolio routes are not shipped.
// No external calls, customer data, spend, or payment mutations.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const mustExist = [
  'index.html','catalog.json','avatar.html','billboard.html',
  'agent-bridge.html','truth-oracle.html','tools/free.html','register/index.html',
  'agentic-commerce-remediation-blueprint.html','auctions.html','trust/index.html',
  'mtg/index.html','go/index.html','marketplace-ecosystem.html'
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
const ecosystem=fs.readFileSync(path.join(root,'public/marketplace-ecosystem.html'),'utf8');
if (!ecosystem.includes('/api/marketplace/listings') || !ecosystem.includes('/api/marketplace/intake') || !ecosystem.includes('/api/marketplace/seller-intake')) throw new Error('MARKETPLACE_ECOSYSTEM_API_CONTRACT_MISSING');
if (!ecosystem.includes('No inventory is invented') || !ecosystem.includes('No sample demand is displayed')) throw new Error('MARKETPLACE_ECOSYSTEM_MUST_NOT_FAKE_LIQUIDITY');
console.log('BECK_PUBLIC_RELEASE_FILES_PASS: '+mustExist.length+' routes, '+catalog.products.length+' catalog entries; no sale asserted');
