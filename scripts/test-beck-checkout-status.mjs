import assert from 'node:assert/strict';
import {test} from 'node:test';
import handler from '../api/checkout-status.mjs';
import {SKU,LOOKUP,LIVE_PRICE,LIVE_PRODUCT} from '../api/_commander-contract.mjs';
const ID='cs_live_SYNTHETIC1234567890';
const url='https://dreamledger.org/api/checkout-status?session_id='+ID;
const listing='synthetic-listing';
const base=()=>({
 id:ID,livemode:true,mode:'payment',status:'complete',payment_status:'paid',currency:'nzd',amount_subtotal:2900,
 metadata:{sku_id:SKU,marketplace_listing_id:listing},
 line_items:{has_more:false,data:[{quantity:1,price:{id:LIVE_PRICE,lookup_key:LOOKUP,unit_amount:2900,currency:'nzd',metadata:{dreamledger_sku:SKU},product:{id:LIVE_PRODUCT,metadata:{dreamledger_sku:SKU}}}}]}
});
const saved={fetch:globalThis.fetch,STRIPE_SECRET_KEY:process.env.STRIPE_SECRET_KEY,SUPABASE_URL:process.env.SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY:process.env.SUPABASE_SERVICE_ROLE_KEY};
function env(){process.env.STRIPE_SECRET_KEY='synthetic-test-key';delete process.env.SUPABASE_URL;delete process.env.SUPABASE_SERVICE_ROLE_KEY;}
function fake(session,orders=[],fulfillments=[]){
 const calls=[];
 globalThis.fetch=async (address,opts={})=>{
   calls.push({url:String(address),method:opts.method||'GET'});
   let data=session;
   if(String(address).includes('marketplace_orders?'))data=orders;
   if(String(address).includes('marketplace_fulfillments?'))data=fulfillments;
   return new Response(JSON.stringify(data),{status:200});
 };
 return calls;
}
async function state(target=url){const r=await handler(new Request(target));return {status:r.status,body:await r.json()};}
try{
 await test('invalid return id is not a receipt',async()=>{env();const calls=fake(base());assert.equal((await state('https://dreamledger.org/api/checkout-status?session_id=oops')).body.state,'invalid_session');assert.equal(calls.length,0);});
 await test('missing server credentials fail closed',async()=>{env();delete process.env.STRIPE_SECRET_KEY;const calls=fake(base());assert.equal((await state()).status,503);assert.equal(calls.length,0);});
 await test('unpaid remains unpaid',async()=>{env();const s=base();s.payment_status='unpaid';fake(s);assert.equal((await state()).body.state,'awaiting_payment');});
 await test('mismatched session SKU blocks access',async()=>{env();const s=base();s.metadata.sku_id='CMD-DIAG-29';fake(s);assert.equal((await state()).body.state,'product_mismatch');});
 await test('mismatched product blocks access',async()=>{env();const s=base();s.line_items.data[0].price.product.metadata.dreamledger_sku='WRONG';fake(s);assert.equal((await state()).body.state,'product_mismatch');});
 await test('paid Stripe with no webhook record stays pending',async()=>{env();fake(base());assert.equal((await state()).body.state,'paid_pending_record');});
 await test('paid with webhook-confirmed order and fulfillment is read-only',async()=>{env();process.env.SUPABASE_URL='https://example.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='synthetic-key';const calls=fake(base(),[{id:'order-1',payment_status:'paid',listing_id:listing}],[{fulfillment_id:'ful-1',status:'queued'}]);assert.equal((await state()).body.state,'paid_recorded');assert.equal((await state()).body.state,'paid_recorded');assert.equal(calls.every(x=>x.method==='GET'),true);assert.equal(calls.length,6);});
 await test('paid with absent order cannot unlock intake',async()=>{env();process.env.SUPABASE_URL='https://example.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='synthetic-key';fake(base(),[]);assert.equal((await state()).body.state,'paid_pending_record');});
} finally{
 globalThis.fetch=saved.fetch;
 for(const k of ['STRIPE_SECRET_KEY','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY']){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}
}
console.log('BECK_CHECKOUT_HERMETIC_PASS: 8 scenarios, zero real requests or charges');
