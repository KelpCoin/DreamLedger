'use strict';

const crypto=require('crypto');
const {run:runGauntlet}=require('../gauntlet/CandidateGauntlet');
const Toll=require('../runtime/TollRoad');
const STRIPE_SECRET_KEY=String(process.env.STRIPE_SECRET_KEY||process.env.STRIPE_LIVE_SECRET_KEY||'');
const PUBLIC_BASE=String(process.env.PUBLIC_BASE_URL||'https://dreamledger.org').replace(/\/$/,'');
function stripeForm(values){const form=new URLSearchParams();for(const [k,v] of Object.entries(values))form.set(k,String(v));return form;}
async function createCheckout(scope){
  const cfg=Toll.config();
  const priceNzd=scope==='gauntlet'?cfg.gauntletPriceNzd:cfg.truthPriceNzd;
  if(!STRIPE_SECRET_KEY||!(priceNzd>0))throw Object.assign(new Error('Toll checkout is not configured'),{statusCode:503});
  const sessionId='toll_'+crypto.randomUUID();
  const productName=scope==='gauntlet'?'DreamLedger Automated Gauntlet Access':'DreamLedger Truth / Evidence Wall Access';
  const response=await fetch('https://api.stripe.com/v1/checkout/sessions',{method:'POST',headers:{Authorization:'Bearer '+STRIPE_SECRET_KEY,'Content-Type':'application/x-www-form-urlencoded','Idempotency-Key':'dreamledger-toll-'+sessionId},body:stripeForm({mode:'payment',client_reference_id:sessionId,'line_items[0][price_data][currency]':'nzd','line_items[0][price_data][unit_amount]':Math.round(priceNzd*100),'line_items[0][price_data][product_data][name]':productName,'line_items[0][quantity]':'1','metadata[toll_scope]':scope,'metadata[toll_request_id]':sessionId,'metadata[toll_price_nzd]':String(priceNzd),'metadata[toll_product]':productName,'payment_intent_data[metadata][toll_scope]':scope,'payment_intent_data[metadata][toll_request_id]':sessionId,success_url:PUBLIC_BASE+'/toll-road?checkout=success&scope='+scope+'&session_id={CHECKOUT_SESSION_ID}',cancel_url:PUBLIC_BASE+'/toll-road?checkout=cancelled&scope='+scope})});
  const text=await response.text();let data;try{data=JSON.parse(text||'{}')}catch{data={}};
  if(!response.ok)throw Object.assign(new Error(data?.error?.message||'Stripe checkout creation failed'),{statusCode:502});
  return data;
}
async function redeem(scope,sessionId){
  if(!STRIPE_SECRET_KEY)throw Object.assign(new Error('Stripe secret key is not configured'),{statusCode:503});
  const response=await fetch('https://api.stripe.com/v1/checkout/sessions/'+encodeURIComponent(sessionId)+'?expand[]=line_items',{headers:{Authorization:'Bearer '+STRIPE_SECRET_KEY}});
  const text=await response.text();let data;try{data=JSON.parse(text||'{}')}catch{data={}};
  if(!response.ok)throw Object.assign(new Error(data?.error?.message||'Stripe session lookup failed'),{statusCode:502});
  if(data.livemode!==true||data.payment_status!=='paid'||data.metadata?.toll_scope!==scope)throw Object.assign(new Error('Settled payment required before key issuance'),{statusCode:402});
  const cfg=Toll.config();
  const expectedPriceNzd=scope==='gauntlet'?cfg.gauntletPriceNzd:cfg.truthPriceNzd;
  const expectedAmount=Math.round(expectedPriceNzd*100);
  const line=data.line_items?.data?.[0];
  if(line && Number(line.amount_total||line.price?.unit_amount||0)!==expectedAmount)throw Object.assign(new Error('Checkout amount attribution mismatch'),{statusCode:409});
  return {status:'ENTITLED',key:Toll.issueKey({keyId:'TOLL_'+String(sessionId).slice(-24),tier:scope,callsRemaining:100000,reference:sessionId})};
}

function send(res,status,body){
  if(res.writableEnded)return true;
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  res.end(JSON.stringify(body));
  return true;
}

function readJson(req){
  return new Promise((resolve,reject)=>{
    let raw='';
    req.on('data',chunk=>{
      raw+=chunk;
      if(raw.length>500000){reject(Object.assign(new Error('Request too large'),{statusCode:413}));req.destroy();}
    });
    req.on('end',()=>{try{resolve(JSON.parse(raw||'{}'));}catch{reject(Object.assign(new Error('Invalid JSON'),{statusCode:400}));}});
    req.on('error',reject);
  });
}

function authorize(req,tier){
  const checked=Toll.verifyKey(Toll.headerKey(req),tier);
  if(!checked.ok)throw Object.assign(new Error(checked.error),{statusCode:checked.error==='toll_wall_not_configured'?503:401});
  return checked.payload;
}


async function supabaseRpc(name, body){
  const base=String(process.env.SUPABASE_URL||'').replace(/\/$/,'');
  const key=String(process.env.SUPABASE_SERVICE_ROLE_KEY||'');
  if(!base||!key)throw Object.assign(new Error('Toll entitlement store is not configured'),{statusCode:503});
  const r=await fetch(base+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const text=await r.text();let data;try{data=JSON.parse(text||'null')}catch{data=null}
  if(!r.ok)throw Object.assign(new Error('Toll entitlement store request failed'),{statusCode:502});
  return data;
}
function roadCatalog(){
  const c=Toll.config();
  return [{
    road_id:Toll.AGENT_BRIDGE_ROAD_ID,
    slug:'agent-bridge-events',
    title:'Agent Bridge Events',
    description:'POST structured events and receive a deterministic receipt. 100 calls for NZ$19, valid for 30 days.',
    price_nzd:c.agentBridgePriceNzd,
    calls_per_pack:c.agentBridgeCalls,
    ttl_days:c.agentBridgeTtlDays,
    route:'/api/agent-bridge/events',
    checkout:'/api/toll/v1/checkout/road/agent-bridge-events',
    status:'published'
  }];
}
async function createRoadCheckout(slug){
  if(slug!=='agent-bridge-events')throw Object.assign(new Error('unknown_road'),{statusCode:404});
  const c=Toll.config();
  if(!STRIPE_SECRET_KEY||!(c.agentBridgePriceNzd>0))throw Object.assign(new Error('Road checkout is not configured'),{statusCode:503});
  const sessionId='road_'+crypto.randomUUID();
  const response=await fetch('https://api.stripe.com/v1/checkout/sessions',{method:'POST',headers:{Authorization:'Bearer '+STRIPE_SECRET_KEY,'Content-Type':'application/x-www-form-urlencoded','Idempotency-Key':'dreamledger-road-'+sessionId},body:stripeForm({
    mode:'payment',client_reference_id:sessionId,
    'line_items[0][price_data][currency]':'nzd',
    'line_items[0][price_data][unit_amount]':Math.round(c.agentBridgePriceNzd*100),
    'line_items[0][price_data][product_data][name]':'DreamLedger Agent Bridge - 100 event calls',
    'line_items[0][quantity]':'1',
    'metadata[road_id]':Toll.AGENT_BRIDGE_ROAD_ID,
    'metadata[road_slug]':'agent-bridge-events',
    'metadata[calls_per_pack]':String(c.agentBridgeCalls),
    'metadata[ttl_days]':String(c.agentBridgeTtlDays),
    success_url:PUBLIC_BASE+'/toll-road?checkout=road-success&road=agent-bridge-events&session_id={CHECKOUT_SESSION_ID}',
    cancel_url:PUBLIC_BASE+'/toll-road?checkout=cancelled&road=agent-bridge-events'
  })});
  const text=await response.text();let data;try{data=JSON.parse(text||'{}')}catch{data={}};
  if(!response.ok)throw Object.assign(new Error(data?.error?.message||'Stripe checkout creation failed'),{statusCode:502});
  return data;
}
async function redeemRoad(slug,sessionId){
  if(slug!=='agent-bridge-events')throw Object.assign(new Error('unknown_road'),{statusCode:404});
  if(!STRIPE_SECRET_KEY)throw Object.assign(new Error('Stripe secret key is not configured'),{statusCode:503});
  const response=await fetch('https://api.stripe.com/v1/checkout/sessions/'+encodeURIComponent(sessionId)+'?expand[]=line_items',{headers:{Authorization:'Bearer '+STRIPE_SECRET_KEY}});
  const text=await response.text();let data;try{data=JSON.parse(text||'{}')}catch{data={}};
  if(!response.ok)throw Object.assign(new Error(data?.error?.message||'Stripe session lookup failed'),{statusCode:502});
  const c=Toll.config(), expected=Math.round(c.agentBridgePriceNzd*100), line=data.line_items?.data?.[0];
  if(data.livemode!==true||data.payment_status!=='paid'||data.metadata?.road_id!==Toll.AGENT_BRIDGE_ROAD_ID)throw Object.assign(new Error('Settled payment required before key issuance'),{statusCode:402});
  if(!line||Number(line.amount_total||line.price?.unit_amount||0)!==expected)throw Object.assign(new Error('Checkout amount attribution mismatch'),{statusCode:409});
  const keyId='ROAD_'+String(sessionId).slice(-24);
  const expiresAt=new Date(Date.now()+c.agentBridgeTtlDays*86400000).toISOString();
  const result=await supabaseRpc('upsert_toll_entitlement',{p_entitlement_id:'ENT_'+keyId,p_road_id:Toll.AGENT_BRIDGE_ROAD_ID,p_buyer_reference_hash:crypto.createHash('sha256').update(String(data.customer_details?.email||data.customer_email||sessionId)).digest('hex'),p_stripe_payment_id:String(data.payment_intent||sessionId),p_key_id:keyId,p_calls_remaining:c.agentBridgeCalls,p_expires_at:expiresAt,p_reference:sessionId});
  const callsRemaining=Number(result?.calls_remaining||0);
  if(callsRemaining<1)throw Object.assign(new Error('Toll entitlement exhausted'),{statusCode:409});
  const key=Toll.issueKey({keyId,tier:'agent_bridge',roadId:Toll.AGENT_BRIDGE_ROAD_ID,callsRemaining,expiresAt:result?.expires_at||expiresAt,reference:sessionId});
  return {status:'ENTITLED',key,road_id:Toll.AGENT_BRIDGE_ROAD_ID,calls_remaining:callsRemaining,expires_at:result?.expires_at||expiresAt};
}
async function handleAgentBridge(req,res,path){
  if(path==='/api/toll/v1/catalog'&&req.method==='GET')return send(res,200,{schema:'dreamledger/toll-catalog/v1',roads:roadCatalog()});
  if(path==='/api/toll/v1/checkout/road/agent-bridge-events'&&req.method==='GET'){
    try{const session=await createRoadCheckout('agent-bridge-events');res.writeHead(303,{Location:session.url,'Cache-Control':'no-store'});res.end();return true}catch(e){return send(res,e.statusCode||502,{error:e.message});}
  }
  if(path==='/api/toll/v1/redeem/road/agent-bridge-events'&&req.method==='GET'){
    const u=new URL(req.url,'https://dreamledger.org'),sid=u.searchParams.get('session_id');
    if(!sid)return send(res,400,{error:'session_id_required'});
    try{return send(res,200,{schema:'dreamledger/toll-road-redeem/v1',...(await redeemRoad('agent-bridge-events',sid))});}catch(e){return send(res,e.statusCode||502,{error:e.message});}
  }
  if(path==='/api/agent-bridge/events'&&req.method==='POST'){
    const checked=Toll.verifyKey(Toll.headerKey(req),'agent_bridge');
    if(!checked.ok)return send(res,402,{error:checked.error,buy:'/toll-road'});
    if(checked.payload.road_id!==Toll.AGENT_BRIDGE_ROAD_ID)return send(res,403,{error:'road_scope_denied'});
    const body=await readJson(req);
    const eventId='evt_'+crypto.randomUUID();
    const inputHash=crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex');
    const output={schema:'dreamledger/agent-bridge-event-receipt/v1',event_id:eventId,road_id:Toll.AGENT_BRIDGE_ROAD_ID,key_id:checked.payload.key_id,accepted:true,input_hash:inputHash,received_at:new Date().toISOString(),fulfillment:'automated_receipt'};
    try{
      const consumed=await supabaseRpc('consume_and_record_toll_call',{p_road_id:Toll.AGENT_BRIDGE_ROAD_ID,p_key_id:checked.payload.key_id,p_event_id:eventId,p_input_hash:inputHash,p_output:output,p_calls:1});
      if(!consumed?.consumed)return send(res,402,{error:consumed?.error||'toll_key_exhausted',buy:'/toll-road'});
      output.calls_remaining=Number(consumed.calls_remaining||0);
    }catch(e){return send(res,502,{error:e.message});}
    return send(res,200,output);
  }
  return false;
}

async function handle(req,res,path){
  if(await handleAgentBridge(req,res,path))return true;
  if(path==='/api/toll/v1/manifest'&&req.method==='GET')return send(res,200,Toll.publicManifest());
  if(path.startsWith('/api/toll/v1/checkout/')&&req.method==='GET'){
    const scope=path.split('/').pop();
    if(!['gauntlet','truth'].includes(scope))return send(res,404,{error:'unknown_toll_scope'});
    try{const session=await createCheckout(scope);res.writeHead(303,{Location:session.url,'Cache-Control':'no-store'});res.end();return true;}catch(e){return send(res,e.statusCode||502,{error:e.message});}
  }
  if(path.startsWith('/api/toll/v1/redeem/')&&req.method==='GET'){
    const scope=path.split('/').pop();
    const u=new URL(req.url,'https://dreamledger.org');
    const sessionId=u.searchParams.get('session_id');
    if(!['gauntlet','truth'].includes(scope)||!sessionId)return send(res,400,{error:'scope_and_session_id_required'});
    try{return send(res,200,{schema:'dreamledger/toll-redeem/v1',...(await redeem(scope,sessionId))});}catch(e){return send(res,e.statusCode||502,{error:e.message});}
  }

  if(path==='/api/toll/v1/gauntlet'&&req.method==='POST'){
    const key=authorize(req,'gauntlet');
    const candidate=await readJson(req);
    const proof=runGauntlet(candidate);
    return send(res,proof.status==='PASS'?200:422,{
      schema:'dreamledger/toll-gauntlet-result/v1',
      key_id:key.key_id,
      service:'DECISION-CHECK',
      human_minutes:0,
      public_execution:'AUTOMATED_DIGITAL_RESULT',
      result:proof
    });
  }

  if(path==='/api/toll/v1/truth'&&req.method==='POST'){
    const key=authorize(req,'truth');
    const body=await readJson(req);
    const evidence=Array.isArray(body.evidence)?body.evidence:[];
    const contradictions=Array.isArray(body.contradictions)?body.contradictions:[];
    const unresolved=Array.isArray(body.unresolved)?body.unresolved:[];
    const result={
      schema:'dreamledger/toll-truth-input/v1',
      key_id:key.key_id,
      service:'EVIDENCE-CHECK',
      verdict:contradictions.length?'CONTRADICTED':(evidence.length?'OBSERVED':'UNVERIFIED'),
      evidence_count:evidence.length,
      contradiction_count:contradictions.length,
      unresolved_count:unresolved.length,
      economic_truth_unchanged:true,
      note:'This service classifies the supplied evidence state. It does not create or alter payment, buyer, settlement, fulfilment or other external economic facts.'
    };
    return send(res,200,result);
  }

  if(path==='/api/toll/v1/key/check'&&req.method==='GET'){
    const key=authorize(req,null);
    return send(res,200,{schema:'dreamledger/toll-key-check/v1',key_id:key.key_id,tier:key.tier,expires_at:key.expires_at,calls_remaining:key.calls_remaining});
  }

  return false;
}

module.exports={handle};
