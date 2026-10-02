'use strict';

const crypto=require('crypto');
const {run:runGauntlet}=require('../gauntlet/CandidateGauntlet');
const Toll=require('../runtime/TollRoad');
const STRIPE_SECRET_KEY=String(process.env.STRIPE_SECRET_KEY||process.env.STRIPE_LIVE_SECRET_KEY||'');
const PUBLIC_BASE=String(process.env.PUBLIC_BASE_URL||'https://dreamledger.org').replace(/\/$/,'');
function stripeForm(values){const form=new URLSearchParams();for(const [k,v] of Object.entries(values))form.set(k,String(v));return form;}
async function createCheckout(scope){
  const priceId=scope==='gauntlet'?Toll.config().gauntletPriceId:Toll.config().truthPriceId;
  if(!STRIPE_SECRET_KEY||!priceId)throw Object.assign(new Error('Dedicated toll price is not configured'),{statusCode:503});
  const sessionId='toll_'+crypto.randomUUID();
  const response=await fetch('https://api.stripe.com/v1/checkout/sessions',{method:'POST',headers:{Authorization:'Bearer '+STRIPE_SECRET_KEY,'Content-Type':'application/x-www-form-urlencoded','Idempotency-Key':'dreamledger-toll-'+sessionId},body:stripeForm({mode:'payment',client_reference_id:sessionId,'line_items[0][price]':priceId,'line_items[0][quantity]':'1','metadata[toll_scope]':scope,'metadata[toll_request_id]':sessionId,success_url:PUBLIC_BASE+'/toll-road?checkout=success&scope='+scope+'&session_id={CHECKOUT_SESSION_ID}',cancel_url:PUBLIC_BASE+'/toll-road?checkout=cancelled&scope='+scope})});
  const text=await response.text();let data;try{data=JSON.parse(text||'{}')}catch{data={}};
  if(!response.ok)throw Object.assign(new Error(data?.error?.message||'Stripe checkout creation failed'),{statusCode:502});
  return data;
}
async function redeem(scope,sessionId){
  if(!STRIPE_SECRET_KEY)throw Object.assign(new Error('Stripe secret key is not configured'),{statusCode:503});
  const response=await fetch('https://api.stripe.com/v1/checkout/sessions/'+encodeURIComponent(sessionId),{headers:{Authorization:'Bearer '+STRIPE_SECRET_KEY}});
  const text=await response.text();let data;try{data=JSON.parse(text||'{}')}catch{data={}};
  if(!response.ok)throw Object.assign(new Error(data?.error?.message||'Stripe session lookup failed'),{statusCode:502});
  if(data.livemode!==true||data.payment_status!=='paid'||data.metadata?.toll_scope!==scope)throw Object.assign(new Error('Settled payment required before key issuance'),{statusCode:402});
  const priceId=scope==='gauntlet'?Toll.config().gauntletPriceId:Toll.config().truthPriceId;
  if(priceId&&Array.isArray(data.line_items?.data)&&data.line_items.data.length){
    const paidPrice=String(data.line_items.data[0]?.price?.id||'');
    if(paidPrice&&paidPrice!==priceId)throw Object.assign(new Error('Checkout price attribution mismatch'),{statusCode:409});
  }
  return {status:'ENTITLED',key:Toll.issueKey({keyId:'TOLL_'+String(sessionId).slice(-24),tier:scope,callsRemaining:scope==='gauntlet'?10:10,reference:sessionId})};
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

async function handle(req,res,path){
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
      service:'GAUNTLET-RUN',
      human_minutes:0,
      public_execution:'NO_EXTERNAL_ACTION',
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
      service:'TRUTH-ORACLE-ACCESS',
      verdict:contradictions.length?'CONTRADICTED':(evidence.length?'OBSERVED':'UNVERIFIED'),
      evidence_count:evidence.length,
      contradiction_count:contradictions.length,
      unresolved_count:unresolved.length,
      economic_truth_unchanged:true,
      note:'This service reports the supplied evidence state. It does not create payment, buyer, settlement, fulfillment, or verified economic truth.'
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
