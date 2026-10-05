'use strict';

const crypto=require('crypto');
const {run:runGauntlet}=require('../gauntlet/CandidateGauntlet');
const Toll=require('../runtime/TollRoad');
const STRIPE_SECRET_KEY=String(process.env.STRIPE_SECRET_KEY||process.env.STRIPE_LIVE_SECRET_KEY||'');
const PUBLIC_BASE=String(process.env.PUBLIC_BASE_URL||'https://dreamledger.org').replace(/\/$/,'');

const SCOPES = {
  gauntlet: { priceKey: 'gauntletPriceNzd', product: 'DreamLedger Automated Gauntlet Access', calls: 100000 },
  truth: { priceKey: 'truthPriceNzd', product: 'DreamLedger Truth / Evidence Wall Access', calls: 100000 },
  'bridge-events': { priceKey: 'bridgeEventsPriceNzd', product: 'DreamLedger Agent Bridge Events Pack (100 calls)', calls: 100 },
  'route-lease': { priceKey: 'routeLeasePriceNzd', product: 'DreamLedger Route Lease (basic, 30 days)', calls: 10000 },
  'gauntlet-pack': { priceKey: 'gauntletPackPriceNzd', product: 'DreamLedger Gauntlet Pack (20 approvals)', calls: 20 },
  'micro-ingest': { priceKey: 'defaultPackPriceNzd', product: 'DreamLedger Micro Event Ingest (500)', calls: 500, fixedPrice: 5 },
  'job-claim': { priceKey: 'defaultPackPriceNzd', product: 'DreamLedger Job Claim Pack (200)', calls: 200, fixedPrice: 9 },
  'heartbeat': { priceKey: 'defaultPackPriceNzd', product: 'DreamLedger Heartbeat Pack (1000)', calls: 1000, fixedPrice: 4 },
  'route-exclusive': { priceKey: 'defaultPackPriceNzd', product: 'DreamLedger Exclusive Route Lease', calls: 50000, fixedPrice: 99 },
  'route-shared': { priceKey: 'defaultPackPriceNzd', product: 'DreamLedger Shared Route Lease', calls: 5000, fixedPrice: 9 },
  'gauntlet-rush': { priceKey: 'defaultPackPriceNzd', product: 'DreamLedger Gauntlet Rush (5 tickets)', calls: 5, fixedPrice: 5 },
  'gauntlet-async': { priceKey: 'defaultPackPriceNzd', product: 'DreamLedger Gauntlet Async Pack (20)', calls: 20, fixedPrice: 8 },
  'note-write': { priceKey: 'defaultPackPriceNzd', product: 'DreamLedger Durable Note Write Pack (200)', calls: 200, fixedPrice: 7 }
};

function stripeForm(values){const form=new URLSearchParams();for(const [k,v] of Object.entries(values))form.set(k,String(v));return form;}

function priceFor(scope){
  const cfg=Toll.config();
  const def=SCOPES[scope];
  if(!def) return 0;
  if(def.fixedPrice != null) return Number(def.fixedPrice);
  return Number(cfg[def.priceKey] || 0);
}

async function createCheckout(scope){
  const priceNzd=priceFor(scope);
  if(!STRIPE_SECRET_KEY||!(priceNzd>0))throw Object.assign(new Error('Toll checkout is not configured'),{statusCode:503});
  const def=SCOPES[scope];
  const sessionId='toll_'+crypto.randomUUID();
  const productName=def.product;
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
  const expectedPriceNzd=priceFor(scope);
  const expectedAmount=Math.round(expectedPriceNzd*100);
  const line=data.line_items?.data?.[0];
  if(line && Number(line.amount_total||line.price?.unit_amount||0)!==expectedAmount)throw Object.assign(new Error('Checkout amount attribution mismatch'),{statusCode:409});
  const def=SCOPES[scope]||{calls:100};
  return {status:'ENTITLED',key:Toll.issueKey({keyId:'TOLL_'+String(sessionId).slice(-24),tier:scope,callsRemaining:def.calls,reference:sessionId})};
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

function meterResult(key, service, extra){
  return Object.assign({
    schema: 'dreamledger/toll-metered-result/v1',
    key_id: key.key_id,
    service,
    accepted: true,
    economic_truth_unchanged: true,
    received_at: new Date().toISOString()
  }, extra || {});
}

async function handle(req,res,path){
  if(path==='/api/toll/v1/manifest'&&req.method==='GET')return send(res,200,Toll.publicManifest());

  if(path.startsWith('/api/toll/v1/checkout/')&&(req.method==='GET'||req.method==='POST')){
    const scope=path.split('/').pop();
    if(!SCOPES[scope])return send(res,404,{error:'unknown_toll_scope'});
    try{
      const session=await createCheckout(scope);
      if(req.method==='GET'){
        res.writeHead(303,{Location:session.url,'Cache-Control':'no-store'});
        res.end();
        return true;
      }
      return send(res,200,{
        schema:'dreamledger/toll-checkout/v1',
        scope,
        session_id:session.id,
        url:session.url,
        amount_nzd:priceFor(scope),
        note:'Pay on Stripe. On success, redeem with session_id to receive the access key. No key without settled payment.'
      });
    }catch(e){return send(res,e.statusCode||502,{error:e.message});}
  }

  if(path.startsWith('/api/toll/v1/redeem/')&&(req.method==='GET'||req.method==='POST')){
    const scope=path.split('/').pop();
    const u=new URL(req.url,'https://dreamledger.org');
    let sessionId=u.searchParams.get('session_id');
    if(!sessionId&&req.method==='POST'){
      try{
        const body=await readJson(req);
        sessionId=body&&body.session_id?String(body.session_id):null;
      }catch(e){return send(res,e.statusCode||400,{error:e.message});}
    }
    if(!SCOPES[scope]||!sessionId)return send(res,400,{error:'scope_and_session_id_required'});
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

  if(path==='/api/toll/v1/bridge-events'&&req.method==='POST'){
    const key=authorize(req,'bridge-events');
    const body=await readJson(req);
    return send(res,200,meterResult(key,'AGENT-BRIDGE-EVENT',{payload_echo:typeof body==='object'?Object.keys(body):[]}));
  }

  // Thin metered endpoints for next-batch scopes (authorize + accept only)
  const thinMeters = {
    '/api/toll/v1/micro-ingest': 'micro-ingest',
    '/api/toll/v1/job-claim': 'job-claim',
    '/api/toll/v1/heartbeat': 'heartbeat',
    '/api/toll/v1/note-write': 'note-write',
    '/api/toll/v1/route-lease': 'route-lease',
    '/api/toll/v1/route-exclusive': 'route-exclusive',
    '/api/toll/v1/route-shared': 'route-shared',
    '/api/toll/v1/gauntlet-pack': 'gauntlet-pack',
    '/api/toll/v1/gauntlet-rush': 'gauntlet-rush',
    '/api/toll/v1/gauntlet-async': 'gauntlet-async'
  };
  if(req.method==='POST' && thinMeters[path]){
    const tier = thinMeters[path];
    const key = authorize(req, tier);
    const body = await readJson(req).catch(()=>({}));
    return send(res,200,meterResult(key, tier.toUpperCase(), {payload_keys: typeof body==='object' ? Object.keys(body) : []}));
  }

  if(path==='/api/toll/v1/key/check'&&req.method==='GET'){
    const key=authorize(req,null);
    return send(res,200,{schema:'dreamledger/toll-key-check/v1',key_id:key.key_id,tier:key.tier,expires_at:key.expires_at,calls_remaining:key.calls_remaining});
  }

  return false;
}

module.exports={handle};
