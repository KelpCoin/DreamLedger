'use strict';
const fs=require('fs');
const path=require('path');
const root=path.join(__dirname,'..');
const manifest=path.join(root,'compiled','website','.well-known','ai-catalog.json');
const commerce=path.join(root,'compiled','website','commerce.txt');
for(const file of [manifest,commerce]) if(!fs.existsSync(file)) throw new Error('Missing '+file);
const m=JSON.parse(fs.readFileSync(manifest,'utf8'));
const product=JSON.parse(fs.readFileSync(path.join(root,'catalog','products','COMMANDER-DECK-DIAGNOSTIC-001.json'),'utf8'));
const approved=JSON.parse(fs.readFileSync(path.join(root,'catalog','offers','approved.json'),'utf8'));
const offer=(approved.approved||[]).find(o=>o.offer_id==='OFFER-CMD-DIAG-29-NZD');
const runner=fs.readFileSync(path.join(root,'runtime','CommercialCellRunner.js'),'utf8');
const checks=[
 ['SCHEMA',m.schema==='dreamledger/ai-catalog/v1'],
 ['CMD_DIAG',m.commerce?.offers?.some(o=>o.offer_id==='OFFER-CMD-DIAG-29-NZD'&&o.price_nzd===29)],
 ['TRUTH_FLOOR',Array.isArray(m.commerce?.offers?.[0]?.truth_floor)&&m.commerce?.offers?.[0]?.truth_floor.includes('funds_available')],
 ['NO_AUTONOMOUS_CHARGE',m.policy?.agent_may_charge_without_authorization===false],
 ['CANONICAL_CHECKOUT_URL_MATCH',Boolean(product.commercial_truth?.payment_link)&&product.commercial_truth.payment_link===offer?.payment_link_url],
 ['CANONICAL_PRICE_MATCH',product.sku==='CMD-DIAG-29'&&Number(product.price)===29&&String(product.currency).toLowerCase()==='nzd'&&Number(offer?.price)===29&&String(offer?.currency).toLowerCase()==='nzd'],
 ['NO_STALE_HARDCODED_PAYMENT_LINK',!runner.includes('plink_1UJ3NlEGgEAnUFF9wAINPrwZ')&&runner.includes('async function resolvePaymentLink()')],
 ['LEDGER_FAILURE_ISOLATION',runner.includes('truthClaimsError')&&runner.includes("'PARTIAL'")]
];
for(const [name,ok] of checks) if(!ok) throw new Error('FAIL '+name);
console.log(JSON.stringify({schema:'DREAMLEDGER/COMMERCIAL-CELL-VERIFY/v1',status:'PASS',checks:checks.map(([name,ok])=>({name,status:ok?'PASS':'FAIL'}))},null,2));
