'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const root=path.join(__dirname,'..','public');
const core=require(path.join(root,'data-rescue-core.js'));
const {verifyFactory}=require(path.join(root,'data-rescue-verify.js'));
(async()=>{
 let count=0;const check=(name,fn)=>{fn();count++;};
 check('quoted linebreak',()=>assert.deepEqual(core.parseCsv('a,b\r\nx,"hello\nworld"\r\n')[1],['x','hello\nworld']));
 check('quoted escaped quotes',()=>assert.deepEqual(core.parseCsv('a,b\nx,"say ""hello"""')[1],['x','say "hello"']));
 check('exact dedup',()=>{const r=core.transform('a,b\n A , 1\nA,1\nB,2\n');assert.equal(r.report.duplicate_rows_removed,1);assert.equal(r.report.output_rows,2)});
 check('blank row',()=>assert.equal(core.transform('a,b\n1,2\n,\n').report.blank_rows_removed,1));
 check('formula payload',()=>{const r=core.transform('a,b\n1,=2+2\n');assert.equal(r.report.formula_cells_escaped,1);assert(r.csv.includes("'=2+2"))});
 check('formula header',()=>{const r=core.transform('=CMD,price\nabc,12\n');assert.equal(r.report.formula_cells_escaped,1);assert(r.csv.startsWith("'=CMD,price"))});
 check('comma quoting',()=>assert.equal(core.transform('a,b\n1,"red, blue"\n').report.output_rows,1));
 check('ragged rows denied',()=>assert.throws(()=>core.parseCsv('a,b\n1,2,3'),/RAGGED_CSV/));
 check('duplicate header denied',()=>assert.throws(()=>core.transform('A,a\n1,2'),/DUPLICATE_HEADER/));
 check('unterminated quote denied',()=>assert.throws(()=>core.parseCsv('a,b\n"foo,bar'),/UNTERMINATED_QUOTE/));
 check('no data denied',()=>assert.throws(()=>core.transform('a,b\n'),/NO_DATA_ROWS/));
 check('blank file denied',()=>assert.throws(()=>core.parseCsv(''),/EMPTY_CSV/));
 check('empty header denied',()=>assert.throws(()=>core.transform('a, \n1,2\n'),/EMPTY_HEADER/));
 check('multiline record count',()=>assert.equal(core.transform('a,b\n"x\ny",2\n').report.input_rows,1));
 check('row conservation',()=>{const r=core.transform('a,b\n1,2\n1,2\n,\n3,4\n');assert(r.report.validation);assert.equal(r.report.input_rows,r.report.output_rows+r.report.duplicate_rows_removed+r.report.blank_rows_removed)});
 const env={STRIPE_SECRET_KEY:'sk_synthetic_only',CSV_RESCUE_LINK_ID:'plink_expected',CSV_RESCUE_PRICE_ID:'price_expected',CSV_RESCUE_ACCOUNT_ID:'acct_expected'};
 const good={livemode:true,status:'complete',payment_status:'paid',mode:'payment',currency:'nzd',amount_total:2900,payment_link:'plink_expected',payment_intent:'pi_fixture',metadata:{silo:'data_tools',sku:'BECK-CSV-RESCUE-29'}};
 const lines={data:[{price:{id:'price_expected'},quantity:1}]};
 const payment={id:'pi_fixture',status:'succeeded',currency:'nzd',amount_received:2900,livemode:true,latest_charge:{payment_intent:'pi_fixture',paid:true,captured:true,currency:'nzd',amount_captured:2900,livemode:true,refunded:false,amount_refunded:0,disputed:false}};
 const mock=(session=good,line=lines,pi=payment,account={id:'acct_expected'})=>async url=>({ok:true,json:async()=>url.endsWith('/account')?account:url.includes('/payment_intents/')?pi:url.includes('/line_items')?line:session});
 const id='cs_live_abcd1234';
 async function entitle(fetcher,code,vars=env){const r=await verifyFactory({fetcher,env:vars})(id);assert.equal(r.code,code);count++}
 await entitle(mock(),200);
 await entitle(mock(),200); // repeated reads do not create orders or provider mutations
 for(const patch of [{refunded:true,amount_refunded:2900},{amount_refunded:1},{disputed:true},{refunded:undefined},{amount_refunded:undefined},{paid:false},{captured:false},{amount_captured:1},{currency:'usd'},{payment_intent:'pi_other'}]) await entitle(mock(good,lines,{...payment,latest_charge:{...payment.latest_charge,...patch}}),403);
 await entitle(mock(good,lines,{...payment,latest_charge:null}),403);
 await entitle(mock(good,lines,payment,{id:'acct_other'}),403);
 await entitle(mock({...good,metadata:{silo:'other',sku:'BECK-CSV-RESCUE-29'}}),403);
 await entitle(mock({...good,payment_intent:null}),403);
 await entitle(mock(good,{...lines,has_more:true}),403);

 await entitle(mock({...good,payment_status:'unpaid'}),403);
 await entitle(mock({...good,livemode:false}),403);
 await entitle(mock({...good,amount_total:2901}),403);
 await entitle(mock({...good,payment_link:'wrong'}),403);
 await entitle(mock(good,{data:[{price:{id:'wrong'},quantity:1}]}),403);
 await entitle(async()=>{throw Error('network unavailable')},503);
 await entitle(mock(),503,{});
 check('bad session denied',()=>{assert(!/^cs_(?:live|test)_[a-zA-Z0-9]+$/.test('invalid'))});
 console.log(JSON.stringify({result:'PASS',tests:count,provider_requests:0,charges:0,customer_sales:0}));
})().catch(e=>{console.error(e);process.exit(1)});