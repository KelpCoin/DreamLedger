'use strict';
// Signed-event regression harness for the staged Commander webhook.
// Synthetic HMAC and in-memory PostgREST stub. NOT provider or DB evidence.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const SKU='COMMANDER-DECK-DIAGNOSTIC-001';
const ALIAS='CMD-DIAG-29';
const SID='cs_live_SYNTHETIC1234567890';
const LISTING='synthetic-listing';
const SECRET='whsec_synthetic_only_not_a_secret';
const PRICE='price_1UFFY1EGgEAnUFF9Yq03zIa7';
const source=fs.readFileSync('supabase/functions/stripe-revenue-41104f355d6878cdd6d1f9dc/index.ts','utf8');
const executable=stripTypeScriptTypes(
  source.replace(/^import .*;\s*$/gm,'')
        .replace('const {default:Stripe}=await import("npm:stripe@22");','const Stripe=globalThis.__Stripe;'),
  {mode:'strip'});
function fixture(){
 const metadata={sku_id:SKU,marketplace_listing_id:LISTING};
 const session={id:SID,livemode:true,mode:'payment',status:'complete',
   payment_status:'paid',currency:'nzd',amount_total:2900,payment_intent:'pi_synthetic',
   metadata:{...metadata},customer_details:{email:'synthetic@example.invalid'}};
 const event={id:'evt_synthetic_123',type:'checkout.session.completed',livemode:true,
   data:{object:session}};
 const verified={...session,amount_subtotal:2900,
   metadata:{...metadata},line_items:{has_more:false,data:[{quantity:1,
     price:{id:PRICE,lookup_key:SKU,metadata:{dreamledger_sku:SKU},
       product:{metadata:{dreamledger_sku:SKU}}}}]}};
 return{event,verified,listing:{id:LISTING,sku:SKU}};
}
function harness(f,overrides={}){
 let handler;const calls={db:[],rpc:[],stripe:[]};
 const db={
   from(table){
     calls.db.push(table);
     return {
       select(){return this},eq(){return this},limit(){return this},
       async maybeSingle(){return {data:null,error:null}},
       async single(){return {data:table==='marketplace_listings'?f.listing:null,error:null}},
       async upsert(){return {error:null}},
       update(){return this}
     };
   },
   async rpc(name,args){
     calls.rpc.push({name,args});
     // Stop at the real settlement boundary: never fabricate a paid order.
     return {data:null,error:{message:'SYNTHETIC_SETTLEMENT_STOP'}};
   }
 };
 class FakeStripe{
   constructor(){this.checkout={sessions:{retrieve:async(id)=>{
     calls.stripe.push(id);return f.verified;
   }}};}
   static createSubtleCryptoProvider(){return {}}
   get webhooks(){return {constructEventAsync:async(raw,header,secret)=>{
     const fields=Object.fromEntries(header.split(',').map(x=>x.split('=')));
     const expected=crypto.createHmac('sha256',secret).update(fields.t+'.'+raw).digest('hex');
     if(fields.v1!==expected)throw Error('INVALID_SYNTHETIC_SIGNATURE');
     return JSON.parse(raw);
   }}}
 }
 const env={SUPABASE_URL:'https://synthetic.supabase.co',
   SUPABASE_SERVICE_ROLE_KEY:'synthetic-role',STRIPE_API_KEY:'synthetic-key',
   STRIPE_WEBHOOK_SIGNING_SECRET:SECRET,...overrides};
 const context={Deno:{env:{get:k=>env[k]},serve:fn=>{handler=fn}},
   createClient:()=>db,createMarketplaceSellerTransfers:async()=>{throw Error('unexpected transfer')},
   Response,Request,console,crypto:crypto.webcrypto,globalThis:null,__Stripe:FakeStripe};
 context.globalThis=context;
 vm.runInNewContext(executable,context,{filename:'stripe-revenue/index.ts'});
 const invoke=async({badSignature=false}={})=>{
   const body=JSON.stringify(f.event),t='1700000000';
   const sig=crypto.createHmac('sha256',SECRET).update(t+'.'+body).digest('hex');
   const response=await handler(new Request('https://synthetic.supabase.co/functions/v1/stripe-revenue',{
     method:'POST',headers:{'stripe-signature':'t='+t+',v1='+(badSignature?'0'.repeat(64):sig)},
     body}));
   return{status:response.status,body:await response.text()};
 };
 return{invoke,calls};
}
test('bad Stripe signature is rejected before any database access',async()=>{
 const h=harness(fixture()),r=await h.invoke({badSignature:true});
 assert.equal(r.status,400);assert.equal(h.calls.db.length,0);
});
test('signed canonical event reaches settlement boundary, but test never writes a paid order',async()=>{
 const h=harness(fixture()),r=await h.invoke();
 assert.equal(r.status,500);
 assert.equal(h.calls.rpc.length,1);
 assert.equal(h.calls.rpc[0].name,'marketplace_settle_stripe_payment');
 assert.equal(h.calls.rpc[0].args.p_amount_nzd,29);
});
test('signed canonical metadata with legacy listing cannot bypass exact Price check',async()=>{
 const f=fixture();f.listing.sku=ALIAS;
 const h=harness(f),r=await h.invoke();
 assert.equal(r.status,409);assert.equal(h.calls.rpc.length,0);
 assert.equal(h.calls.stripe.length,0);
});
test('signed legacy alias metadata and listing cannot settle a diagnostic',async()=>{
 const f=fixture();f.listing.sku=ALIAS;f.event.data.object.metadata.sku_id=ALIAS;
 const h=harness(f),r=await h.invoke();
 assert.equal(r.status,409);assert.equal(h.calls.rpc.length,0);
});
test('diagnostic without marketplace listing cannot create revenue-only entitlement',async()=>{
 const f=fixture();delete f.event.data.object.metadata.marketplace_listing_id;
 const h=harness(f),r=await h.invoke();
 assert.equal(r.status,409);assert.equal(h.calls.rpc.length,0);
});
test('signed test-mode event is never accepted by live-mode settlement',async()=>{
 const f=fixture();f.event.livemode=false;
 const h=harness(f),r=await h.invoke();
 assert.equal(r.status,409);assert.equal(h.calls.rpc.length,0);
});
test('Stripe session metadata drift fails before settlement',async()=>{
 const f=fixture();f.verified.metadata.sku_id=ALIAS;
 const h=harness(f),r=await h.invoke();
 assert.equal(r.status,409);assert.equal(h.calls.rpc.length,0);
});
test('Stripe payment intent mismatch fails before settlement',async()=>{
 const f=fixture();f.verified.payment_intent='pi_wrong';
 const h=harness(f),r=await h.invoke();
 assert.equal(r.status,409);assert.equal(h.calls.rpc.length,0);
});
test('unexpected total or Price cannot settle',async()=>{
 for(const mutation of [f=>{f.verified.amount_total=3000},f=>{f.verified.line_items.data[0].price.id='price_wrong'}]){
   const f=fixture();mutation(f);
   const h=harness(f),r=await h.invoke();
   assert.equal(r.status,409);assert.equal(h.calls.rpc.length,0);
 }
});

const TEST_PROJECT_REF='abcdefghijklmnopqrst';
const TEST_PRICE='price_synthetic_test_commander';
const TEST_ENV={
  BECK_STRIPE_SETTLEMENT_MODE:'test',
  BECK_STRIPE_TEST_PROJECT_REF:TEST_PROJECT_REF,
  BECK_STRIPE_TEST_DIAGNOSTIC_PRICE_ID:TEST_PRICE,
  SUPABASE_URL:'https://'+TEST_PROJECT_REF+'.supabase.co',
  STRIPE_API_KEY:'sk_test_synthetic_only'
};
function testModeFixture(){
  const f=fixture(),sid='cs_test_SYNTHETIC1234567890';
  f.event.livemode=false;f.event.data.object.livemode=false;
  f.event.data.object.id=sid;f.verified.livemode=false;f.verified.id=sid;
  f.verified.line_items.data[0].price.id=TEST_PRICE;
  return f;
}
test('isolated signed test-mode event reaches synthetic settlement boundary only',async()=>{
  const h=harness(testModeFixture(),TEST_ENV),r=await h.invoke();
  assert.equal(r.status,500);assert.equal(h.calls.rpc.length,1);
  assert.equal(h.calls.rpc[0].name,'marketplace_settle_stripe_payment');
  assert.equal(h.calls.rpc[0].args.p_amount_nzd,29);
});
test('test-mode event is rejected before live database access',async()=>{
  const h=harness(testModeFixture()),r=await h.invoke();
  assert.equal(r.status,409);assert.equal(h.calls.db.length,0);
});
test('test-mode cannot target actual production Supabase project',async()=>{
  const h=harness(testModeFixture(),{...TEST_ENV,
    BECK_STRIPE_TEST_PROJECT_REF:'wbwgroygjeyukkspnqiy',
    SUPABASE_URL:'https://wbwgroygjeyukkspnqiy.supabase.co'}),r=await h.invoke();
  assert.equal(r.status,409);assert.equal(h.calls.db.length,0);
});
test('test-mode requires preexisting test Price and test Stripe API key',async()=>{
  for(const overrides of [
    {...TEST_ENV,BECK_STRIPE_TEST_DIAGNOSTIC_PRICE_ID:''},
    {...TEST_ENV,STRIPE_API_KEY:'sk_live_synthetic_only'}
  ]){
    const h=harness(testModeFixture(),overrides),r=await h.invoke();
    assert.equal(r.status,409);assert.equal(h.calls.db.length,0);
  }
});
test('wrong test Price cannot reach settlement RPC',async()=>{
  const f=testModeFixture();f.verified.line_items.data[0].price.id='price_other_test';
  const h=harness(f,TEST_ENV),r=await h.invoke();
  assert.equal(r.status,409);assert.equal(h.calls.rpc.length,0);
});
test('test-mode event with live retrieved Checkout cannot settle',async()=>{
  const f=testModeFixture();f.verified.livemode=true;
  const h=harness(f,TEST_ENV),r=await h.invoke();
  assert.equal(r.status,409);assert.equal(h.calls.rpc.length,0);
});
test('live event cannot access isolated test database',async()=>{
  const h=harness(fixture(),TEST_ENV),r=await h.invoke();
  assert.equal(r.status,409);assert.equal(h.calls.db.length,0);
});
