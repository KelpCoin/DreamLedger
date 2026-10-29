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
// Owner-confirmed CCA discovery and original QR payload are release invariants.
// This prevents beautiful but nonfunctional QR landing pages on either origin.
const cca=JSON.parse(fs.readFileSync(path.join(root,'public/cca-catalog.v1.json'),'utf8'));
if(cca.schema!=='DREAMLEDGER/CCA-DISCOVERY/v1'||cca.canonical_qr?.payload!=='www.dreamledger.org'||cca.canonical_qr?.destination_path!=='/')
  throw new Error('CANONICAL_QR_OR_CCA_SCHEMA_DRIFT');
if(!Array.isArray(cca.cards)||cca.cards.length===0)
  throw new Error('CCA_CATALOGUE_EMPTY');
const ids=new Set();
for(const card of cca.cards){
  if(!card||typeof card.id!=='string'||ids.has(card.id)||typeof card.href!=='string'||!card.href.startsWith('/')||card.href.startsWith('//')||card.href.includes('..')||card.href.includes('?'))
    throw new Error('CCA_CARD_INVALID');
  ids.add(card.id);
  const relative=card.href.endsWith('/')?card.href+'index.html':card.href;
  if(!fs.statSync(path.join(root,'public',relative.slice(1)),{throwIfNoEntry:false})?.isFile())
    throw new Error('CCA_CARD_TARGET_MISSING: '+card.id);
}
const qrPage=fs.readFileSync(path.join(root,'public/go/index.html'),'utf8');
const generated=qrPage.replace('<head>','<head><meta name="bec-compiler" content="WebsiteFaceCompiler/CCA">');
const renderedHome=fs.readFileSync(path.join(root,'public/home.html'),'utf8');
if(renderedHome!==generated||!home.includes('id="rail"')||!home.includes('id="grid"'))
  throw new Error('CCA_HOMEPAGE_NOT_GENERATED_FROM_CANONICAL_TEMPLATE');
if(!vercel.rewrites?.some(rule=>rule.source==='/'&&rule.destination==='/index.html'))
  throw new Error('CANONICAL_QR_ROOT_REWRITE_MISSING');
const server=fs.readFileSync(path.join(root,'public/server.js'),'utf8');
if(!server.includes("'/':'home.html','/index.html':'home.html'"))
  throw new Error('RENDER_CCA_ROOT_ROUTE_DRIFT');
const seller=fs.readFileSync(path.join(root,'public/sell.html'),'utf8');
if(!seller.includes('body.accepted!==true||!body.intake_id')||seller.includes('status.textContent=\'Saved locally.'))
  throw new Error('SELLER_INTAKE_MUST_REQUIRE_SERVER_RECEIPT');
const physical=catalog.products.find(p=>p.id==='EDH_0001');
if(physical&&(physical.price!==400||physical.checkout_available!==false||physical.status!=='held'))
  throw new Error('OWNER_APPROVED_STOCK_PRICE_OR_HOLD_DRIFT');
const truthQuote=catalog.products.find(p=>p.id==='QUOTE-COMPARE-49');
if(truthQuote&&truthQuote.silo!=='truth_oracle')
  throw new Error('QUOTE_COMPARE_TRUTH_ORACLE_OWNERSHIP_DRIFT');

console.log('BECK_PUBLIC_RELEASE_FILES_PASS: '+mustExist.length+' routes, '+catalog.products.length+' catalog entries; B2B aliases verified; no sale asserted');
