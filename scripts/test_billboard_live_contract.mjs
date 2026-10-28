import assert from 'node:assert/strict';
import cryptoNode from 'node:crypto';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';

const edgePath='supabase/functions/dreamledger-billboard-webhook/index.ts';
const source=readFileSync(edgePath,'utf8').replace(/^import\s+["']jsr:[^\n]+\n/m,'');
let handler;
let calls=[];
let activePrice='price_1UCrecEGgEAnUFF9lximUXtk';
let insertOk=true;
let healthRows=[];
const fetchMock=async (url,init={})=>{
  const u=String(url),method=init.method||'GET',body=init.body?String(init.body):'';
  calls.push({url:u,method,body});
  if(u.startsWith('https://api.stripe.com/v1/checkout/sessions/')&&u.includes('/line_items')){
    return new Response(JSON.stringify({data:[{price:{id:activePrice}}]}),{status:200});
  }
  if(u==='https://api.stripe.com/v1/refunds'){
    return new Response(JSON.stringify({id:'re_synthetic'}),{status:200});
  }
  if(u.includes('/rest/v1/billboard_campaigns?stripe_session_id=')){
    return new Response('[]',{status:200});
  }
  if(u.includes('/rest/v1/billboard_campaigns?market=eq.GLOBAL')){
    return new Response(JSON.stringify(healthRows),{status:200});
  }
  if(u.includes('/rest/v1/billboard_campaigns?select=campaign_id,status,x,y,width,height')){
    return new Response(JSON.stringify(healthRows),{status:200});
  }
  if(u.endsWith('/rest/v1/billboard_campaigns')&&method==='POST'){
    if(!insertOk)return new Response(JSON.stringify({message:'synthetic insert failure'}),{status:500});
    const row=JSON.parse(body);
    return new Response(JSON.stringify([row]),{status:201});
  }
  throw new Error('Unexpected outgoing request: '+u);
};
const Deno={env:{get:(key)=>({
  SUPABASE_URL:'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY:'local-service-role',
  STRIPE_SECRET_KEY:'sk_live_synthetic_only',
  STRIPE_WEBHOOK_SECRET:'whsec_local_synthetic_only'
})[key]||''},serve:(fn)=>{handler=fn}};
vm.runInNewContext(stripTypeScriptTypes(source,{mode:'strip'}),{
  Deno,crypto:cryptoNode.webcrypto,fetch:fetchMock,TextEncoder,TextDecoder,Uint8Array,Date,Number,String,JSON,Array,Object,
  Response,Request,URL,URLSearchParams,btoa,console,Set,Math
},{filename:edgePath});
assert.equal(typeof handler,'function');

let r=await handler(new Request('https://example.supabase.co/functions/v1/dreamledger-billboard-webhook',{method:'GET'}));
assert.equal(r.status,200);
let h=await r.json();
assert.equal(h.ok,true);
assert.equal(h.remaining_units,100);
assert.equal(h.canonical.payment_link_id,'plink_1UCrekEGgEAnUFF9XVRM04aG');
assert.equal(h.canonical.price_id,'price_1UCrecEGgEAnUFF9lximUXtk');

const session={
 id:'cs_live_synthetic_billboard',payment_link:'plink_1UCrekEGgEAnUFF9XVRM04aG',
 payment_status:'paid',amount_total:5000,currency:'nzd',payment_intent:'pi_synthetic_only',
 metadata:{sku:'DREAMLEDGER-BILLBOARD-FOUNDING-001'},
 custom_fields:[
  {key:'destination_url',text:{value:'https://dreamledger.org'}},
  {key:'tile_alt_text',text:{value:'Synthetic Billboard Customer'}},
  {key:'tile_image_url',text:{value:''}}
 ],
 customer_details:{email:'synthetic@example.invalid'}
};
const base={id:'evt_synthetic_only',livemode:true,type:'checkout.session.completed',data:{object:session}};
function sign(raw){const ts=Math.floor(Date.now()/1000);return 't='+ts+',v1='+cryptoNode.createHmac('sha256','whsec_local_synthetic_only').update(ts+'.'+raw).digest('hex');}
async function deliver(event,signature){
 const raw=JSON.stringify(event);
 const req=new Request('https://example.supabase.co/functions/v1/dreamledger-billboard-webhook',{method:'POST',headers:{'stripe-signature':signature??sign(raw),'content-type':'application/json'},body:raw});
 const response=await handler(req);return {status:response.status,body:await response.json()};
}

calls=[];
let out=await deliver(base);
assert.equal(out.status,200);
assert.equal(out.body.billboard,true);
assert.equal(out.body.fulfillment.status,'PAID_PENDING_REVIEW');
assert.equal(out.body.fulfillment.x,0);
assert.equal(out.body.fulfillment.y,0);
assert.equal(out.body.fulfillment.width,100);
assert.equal(out.body.fulfillment.height,100);
assert.equal(out.body.fulfillment.title,'Synthetic Billboard Customer');
assert.equal(out.body.fulfillment.destination_url,'https://dreamledger.org');
assert(calls.some(x=>x.url.includes('/line_items')));
assert(calls.some(x=>x.url.endsWith('/rest/v1/billboard_campaigns')&&x.method==='POST'));
assert(!calls.some(x=>x.url.endsWith('/v1/refunds')));

calls=[];out=await deliver(base,'t=1,v1=broken');assert.equal(out.status,400);assert.equal(calls.length,0);
calls=[];out=await deliver({...base,livemode:false});assert.equal(out.status,200);assert.equal(calls.length,0);
calls=[];activePrice='wrong';out=await deliver(base);assert.equal(out.status,400);assert(!calls.some(x=>x.url.endsWith('/rest/v1/billboard_campaigns')&&x.method==='POST'));activePrice='price_1UCrecEGgEAnUFF9lximUXtk';
calls=[];insertOk=false;out=await deliver(base);assert.equal(out.status,200);assert.equal(out.body.refunded,true);assert(calls.some(x=>x.url==='https://api.stripe.com/v1/refunds'));insertOk=true;
healthRows=Array.from({length:100},(_,i)=>({campaign_id:'x'+i,status:'PUBLISHED',x:(i%10)*100,y:Math.floor(i/10)*100,width:100,height:100}));
calls=[];r=await handler(new Request('https://example.supabase.co/functions/v1/dreamledger-billboard-webhook',{method:'GET'}));h=await r.json();assert.equal(r.status,503);assert.equal(h.remaining_units,0);

console.log(JSON.stringify({status:'PASS',mode:'HERMETIC_NO_CHARGE',tests:6,canonical_price_nzd:50,payment_link_id:'plink_1UCrekEGgEAnUFF9XVRM04aG',reservation_state:'PAID_PENDING_REVIEW',refund_on_persistence_failure:true,real_charge:false,production_write:false}));
