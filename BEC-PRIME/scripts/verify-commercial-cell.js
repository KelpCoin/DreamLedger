'use strict';
const fs=require('fs');
const path=require('path');
const root=path.join(__dirname,'..');
const manifest=path.join(root,'compiled','website','.well-known','ai-catalog.json');
const commerce=path.join(root,'compiled','website','commerce.txt');
for(const file of [manifest,commerce]) if(!fs.existsSync(file)) throw new Error('Missing '+file);
const m=JSON.parse(fs.readFileSync(manifest,'utf8'));
const checks=[
 ['SCHEMA',m.schema==='dreamledger/ai-catalog/v1'],
 ['CMD_DIAG',m.commerce?.offers?.some(o=>o.offer_id==='OFFER-CMD-DIAG-29-NZD'&&o.price_nzd===29)],
 ['TRUTH_FLOOR',Array.isArray(m.commerce?.offers?.[0]?.truth_floor)&&m.commerce.offers[0].truth_floor.includes('funds_available')],
 ['NO_AUTONOMOUS_CHARGE',m.policy?.agent_may_charge_without_authorization===false]
];
for(const [name,ok] of checks) if(!ok) throw new Error('FAIL '+name);
console.log(JSON.stringify({schema:'DREAMLEDGER/COMMERCIAL-CELL-VERIFY/v1',status:'PASS',checks:checks.map(([name,ok])=>({name,status:ok?'PASS':'FAIL'}))},null,2));
