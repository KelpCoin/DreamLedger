'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const json=p=>JSON.parse(read(p));
const checks=[],holds=[];
function check(name,ok,detail=''){checks.push({name,ok:!!ok,detail});}
function hold(code,detail){holds.push({code,detail});}
const page=read('public/mtg/index.html'),rootPage=read('mtg/index.html');
const catalog=json('public/data/mtg-catalog.json'),rootCatalog=read('data/mtg-catalog.json');
const front=json('public/catalog.json'),approved=json('BEC-PRIME/catalog/offers/approved.json');
const product=json('BEC-PRIME/catalog/products/COMMANDER-DECK-DIAGNOSTIC-001.json');
const listing=(catalog.products||[]).find(p=>p.sku==='CMD-DIAG-29');
const publicOffer=(front.products||[]).find(p=>p.sku==='CMD-DIAG-29'||p.id==='COMMANDER-DECK-DIAGNOSTIC-001');
const approvedOffer=(approved.approved||[]).find(p=>p.product_sku==='CMD-DIAG-29');
check('root/public MTG storefront copies match',page===rootPage);
check('root/public MTG catalogue copies match',rootCatalog===read('public/data/mtg-catalog.json'));
check('MTG catalogue schema and silo',catalog.schema==='dreamledger/mtg-catalogue/v1'&&catalog.silo==='mtg');
check('unique catalogue IDs',new Set((catalog.products||[]).map(p=>p.id)).size===(catalog.products||[]).length);
check('all catalogue products belong to MTG',(catalog.products||[]).every(p=>p.silo==='mtg'));
check('published products have positive prices',(catalog.products||[]).filter(p=>p.status==='published').every(p=>Number(p.price)>0));
check('HTML escaping covers ampersand/angle brackets',page.includes("'&':'&amp;'")&&page.includes("'<':'&lt;'")&&page.includes("'>' :'&gt;'")||page.includes("'&':'&amp;'")&&page.includes("'<':'&lt;'")&&page.includes("'>' :'&gt;'"));
check('diagnostic CTA uses canonical route',page.includes('href="/mtg/diagnostic.html"')&&!page.includes('8x228r1nfg0l3M32csdwc2I'));
check('canonical diagnostic route remains configured',product.silo==='mtg'&&product.checkout.url==='/mtg/diagnostic.html');
if(approvedOffer&&publicOffer&&publicOffer.checkout_url!==approvedOffer.payment_link_url){
 if(publicOffer.checkout_available===false&&!publicOffer.checkout_url&&listing&&listing.checkout_available===false&&!listing.checkout_url){
  hold('STRIPE_LINK_PARITY','Public catalogue had a different Payment Link than the approved offer. Direct public checkout is disabled; the canonical diagnostic route remains the only checkout path until live Stripe read-back confirms the mapping.');
 }else check('public checkout matches approved offer or is safely held',false,'Mismatched direct Payment Link remains purchasable.');
}else check('public checkout matches approved offer',!!approvedOffer&&!!publicOffer);
check('no payment falsely recorded',product.evidence?.status==='awaiting_first_payment'&&!product.evidence?.transaction_id);
if(product.evidence?.status==='awaiting_first_payment')hold('NO_VERIFIED_TRANSACTION','No settled-and-fulfilled diagnostic order is recorded; economic promotion remains blocked.');
const failures=checks.filter(x=>!x.ok);
const proof={schema:'DREAMLEDGER/MTG-GAUNTLET/v1',verdict:failures.length?'FAIL':holds.length?'PASS_WITH_HOLDS':'PASS',launch_ready:failures.length===0&&holds.length===0,checks,holds,failed_checks:failures.length,truth:{verified_external_revenue_nzd:0,settled_external_payments:0,independent_external_buyers:0,paid_fulfilled_orders:0,verified_outcomes:0}};
console.log(JSON.stringify(proof,null,2));
if(failures.length)process.exitCode=1;
