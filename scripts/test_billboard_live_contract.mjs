// Smoke the versioned production edge-function source in a hermetic Node VM.
// No Stripe requests, database writes, real charge, or revenue-ledger updates.
import assert from 'node:assert/strict';
import cryptoNode from 'node:crypto';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';

const edgePath='supabase/functions/dreamledger-billboard-webhook/index.ts';
const source=readFileSync(edgePath,'utf8').replace(/^import\s+["']jsr:[^\n]+\n/m,'');
const page=readFileSync('public/billboard.html','utf8');
assert(page.includes('NZ$50')&&page.includes('100 x 100'));
assert(page.includes('https://buy.stripe.com/00w4gz6HzeWhcizeZedwc2w'));
assert(!page.includes('https://buy.stripe.com/9B66oH2rj3dz82jcR6dwc2x'));
assert(page.includes('DEMO ONLY')&&page.includes('Biggie Still Here'));
assert(page.includes('content review')||page.includes('content policy'));

let handler;
let calls=[];
let activePrice='price_1U8xD6EGgEAnUFF9KGrq2t7X';
const fetchMock=async (url,init={})=>{
  calls.push({url:String(url),method:init.method||'GET',body:init.body?String(init.body):''});
  if(String(url).startsWith('https://api.stripe.com/v1/checkout/sessions/')){
    return new Response(JSON.stringify({data:[{price:{id:activePrice}}]}),{status:200});
  }
  if(String(url).endsWith('/rest/v1/rpc/billboard_publish_paid')){
    return new Response(JSON.stringify([{campaign_id:'SYNTHETIC_ONLY',status:'PUBLISHED'}]),{status:200});
  }
  throw new Error('Unexpected outgoing request: '+url);
};
const Deno={env:{get:(key)=>({
  SUPABASE_URL:'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY:'local-mock-only',
  STRIPE_SECRET_KEY:'local-mock-only',
  STRIPE_WEBHOOK_SECRET:'local-secret-no-production'
})[key]||''},serve:(fn)=>{handler=fn}};
const stripped=stripTypeScriptTypes(source,{mode:'strip'});
vm.runInNewContext(stripped,{
  Deno,crypto:cryptoNode.webcrypto,fetch:fetchMock,
  TextEncoder,TextDecoder,Uint8Array,Date,Number,String,JSON,Array,Object,
  Response,Request,URLSearchParams,btoa,console
},{filename:edgePath});
assert.equal(typeof handler,'function');

const validSession={
  id:'cs_synthetic_biggie_still_here',livemode:true,payment_status:'paid',
  amount_total:5000,currency:'nzd',payment_intent:'pi_synthetic_only',
  metadata:{sku:'DL-BILLBOARD-100X100-3000-001'},
  custom_fields:[
    {key:'billboard_label',text:{value:'Biggie Still Here'}},
    {key:'destination_url',text:{value:'https://dreamledger.org'}}
  ],
  customer_details:{email:'synthetic@example.invalid'}
};
const base={id:'evt_synthetic_only',type:'checkout.session.completed',livemode:true,data:{object:validSession}};
function sign(raw){const ts=Math.floor(Date.now()/1000);return 't='+ts+',v1='+cryptoNode.createHmac('sha256','local-secret-no-production').update(ts+'.'+raw).digest('hex');}
async function deliver(event,invalidSignature=false){
  const raw=JSON.stringify(event);
  const request=new Request('https://example.supabase.co/functions/v1/dreamledger-billboard-webhook',
    {method:'POST',headers:{'stripe-signature':invalidSignature?'t=1,v1=broken':sign(raw)},body:raw});
  const r=await handler(request);return {status:r.status,body:await r.json()};
}
let out=await deliver(base);
assert.equal(out.status,200);
assert.equal(out.body.billboard,true);
const rpc=calls.find(x=>x.url.endsWith('/rest/v1/rpc/billboard_publish_paid'));
assert(rpc,'Published-placement RPC must be called');
const payload=JSON.parse(rpc.body);
assert.equal(payload.p_label,'Biggie Still Here');
assert.equal(payload.p_destination_url,'https://dreamledger.org');
assert.equal(payload.p_amount_nzd,50);
assert.equal(payload.p_currency,'NZD');
assert.equal(payload.p_checkout_session,validSession.id);
assert(!calls.some(x=>x.url.endsWith('/v1/refunds')),'No refund or charge should be initiated');

calls=[];out=await deliver(base,true);assert.equal(out.status,400);assert.equal(calls.length,0);
calls=[];out=await deliver({...base,livemode:false});assert.equal(out.status,200);assert.equal(calls.length,0);
calls=[];out=await deliver({...base,data:{object:{...validSession,amount_total:4999}}});assert.equal(out.status,400);assert.equal(calls.length,0);
calls=[];out=await deliver({...base,data:{object:{...validSession,payment_status:'unpaid'}}});assert.equal(out.status,200);assert.equal(calls.length,0);
calls=[];out=await deliver({...base,data:{object:{...validSession,metadata:{sku:'OTHER'}}}});assert.equal(out.status,200);assert.equal(calls.length,0);
calls=[];activePrice='wrong_price';out=await deliver(base);assert.equal(out.status,400);assert(!calls.some(x=>x.url.includes('rpc/billboard_publish_paid')));
console.log(JSON.stringify({status:'PASS',tests:8,mode:'HERMETIC_SYNTHETIC_ONLY',sample:'Biggie Still Here',price_nzd:50,provider_network_calls:0,production_writes:0,verified_external_revenue_nzd:0,production_delivery_verified:false}));
