'use strict';
const fs=require('fs');
const path=require('path');
const root=path.join(__dirname,'..');
const required=[
  'compiled/website/index.html',
  'compiled/website/mtg/index.html',
  'compiled/website/truth-oracle.html',
  'compiled/website/truth-oracle.json',
  'compiled/website/transparency-policy.json',
  'catalog/products/COMMANDER-DECK-DIAGNOSTIC-001.json',
  'catalog/offers/approved.json',
  'featured-offer.json'
];
const errors=[];
for(const rel of required){const file=path.join(root,rel);if(!fs.existsSync(file)||fs.statSync(file).size===0)errors.push(`MISSING:${rel}`)}
const product=JSON.parse(fs.readFileSync(path.join(root,'catalog/products/COMMANDER-DECK-DIAGNOSTIC-001.json'),'utf8'));
const approved=JSON.parse(fs.readFileSync(path.join(root,'catalog/offers/approved.json'),'utf8'));
const featured=JSON.parse(fs.readFileSync(path.join(root,'catalog/featured-offer.json'),'utf8'));
const offer=(approved.approved||[]).find(x=>x.offer_id==='OFFER-CMD-DIAG-29-NZD');
if(!offer)errors.push('CANONICAL_OFFER_MISSING');
if(product.price!==29||featured.price!==29||offer?.price!==29)errors.push('PRICE_DRIFT');
if(product.id!=='COMMANDER-DECK-DIAGNOSTIC-001'||featured.product_id!==product.id||offer?.product_id!==product.id)errors.push('IDENTITY_DRIFT');
if(product.sku!=='CMD-DIAG-29'||featured.sku!=='CMD-DIAG-29'||offer?.product_sku!=='CMD-DIAG-29')errors.push('SKU_DRIFT');
if(product.commercial_truth?.payment_link!=='https://buy.stripe.com/9B6aEX5DvdSd4Q73gwdwc1V'||featured.payment_link_url!=='https://buy.stripe.com/9B6aEX5DvdSd4Q73gwdwc1V'||offer?.payment_link_url!=='https://buy.stripe.com/9B6aEX5DvdSd4Q73gwdwc1V')errors.push('STRIPE_LINK_DRIFT');
const homepage=fs.readFileSync(path.join(root,'compiled/website/index.html'),'utf8');
for(const forbidden of ['cinema-event-v1','/cinema.html','dreamiez','Dreamiez'])if(homepage.includes(forbidden))errors.push(`EXCLUDED_SURFACE:${forbidden}`);
const result={schema:'BEC-PRIME/PRODUCTION-CONTRACT/v1',status:errors.length?'FAIL':'PASS',checked_at:new Date().toISOString(),required_files:required,canonical_offer:{offer_id:'OFFER-CMD-DIAG-29-NZD',sku:'CMD-DIAG-29',price_nzd:29,payment_link_status:offer?.payment_link_status||null},excluded_surfaces:['cinema','dreamiez'],errors};
const out=path.join(root,'PROOF-PRODUCTION-CONTRACT.json');fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n','utf8');console.log(JSON.stringify(result,null,2));process.exit(errors.length?1:0);
