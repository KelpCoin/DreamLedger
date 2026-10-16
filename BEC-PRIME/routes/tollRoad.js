'use strict';

const crypto=require('crypto');
const {run:runGauntlet}=require('../gauntlet/CandidateGauntlet');
const Toll=require('../runtime/TollRoad');
const Trinity=require('../runtime/Trinity');
const TollNexus=require('../runtime/TollNexus');
const AgentBridgeEventLedger=require('../runtime/AgentBridgeEventLedger');
const RoadFactory=require('../runtime/TollRoadFactory');
const TollEntitlementLedger=require('../runtime/TollEntitlementLedger');
const STRIPE_SECRET_KEY=String(process.env.STRIPE_LIVE_SECRET_KEY||process.env.STRIPE_SECRET_KEY||'');
const PUBLIC_BASE=String(process.env.PUBLIC_BASE_URL||'https://dreamledger.org').replace(/\/$/,'');
const TOLL_CHECKOUT_ENABLED = String(process.env.TOLL_CHECKOUT_ENABLED || 'false').trim().toLowerCase() === 'true';

const SCOPES = {
  gauntlet: { priceKey: 'gauntletPriceNzd', product: 'DreamLedger Automated Gauntlet Access', calls: 100000 },
  truth: { priceKey: 'truthPriceNzd', product: 'DreamLedger Truth / Evidence Wall Access', calls: 100000 },
  'toll-probe': { priceKey: 'defaultPackPriceNzd', product: 'DreamLedger Toll Probe (one live API probe)', calls: 1, fixedPrice: 0.50 },
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
  'note-write': { priceKey: 'defaultPackPriceNzd', product: 'DreamLedger Durable Note Write Pack (200)', calls: 200, fixedPrice: 7 },
  'trust-attest': { priceKey: 'defaultPackPriceNzd', product: 'DreamLedger Trust Attestation Pack (50)', calls: 50, fixedPrice: 12 },
  'trust-agent': { priceKey: 'defaultPackPriceNzd', product: 'DreamLedger Agent Trust Score Pack (30)', calls: 30, fixedPrice: 10 },
  'seat-agent': { priceKey: 'defaultPackPriceNzd', product: 'DreamLedger Per-Seat Agent Token (5k)', calls: 5000, fixedPrice: 9 },
  'org-key': { priceKey: 'defaultPackPriceNzd', product: 'DreamLedger Org Bridge Key (50k)', calls: 50000, fixedPrice: 49 },
  'priority': { priceKey: 'defaultPackPriceNzd', product: 'DreamLedger Priority Lane Pack (50)', calls: 50, fixedPrice: 25 },
  'prepaid-10k': { priceKey: 'defaultPackPriceNzd', product: 'DreamLedger Prepaid 10k Events', calls: 10000, fixedPrice: 150 },
  'webhook-egress': { priceKey: 'defaultPackPriceNzd', product: 'DreamLedger Webhook Egress Slot', calls: 1000, fixedPrice: 12 },
  'audit-export': { priceKey: 'defaultPackPriceNzd', product: 'DreamLedger Audit Export Access', calls: 30, fixedPrice: 35 },
  'shadow-route': { priceKey: 'defaultPackPriceNzd', product: 'DreamLedger Shadow Route', calls: 5000, fixedPrice: 8 },
  'quarantine': { priceKey: 'defaultPackPriceNzd', product: 'DreamLedger Quarantine Route', calls: 2000, fixedPrice: 22 },
  'academic': { priceKey: 'defaultPackPriceNzd', product: 'DreamLedger Academic Route', calls: 2000, fixedPrice: 3 },
  'transparency': { priceKey: 'defaultPackPriceNzd', product: 'DreamLedger Transparency Log Access', calls: 100, fixedPrice: 15 },
  'agent-passport': { priceKey: 'defaultPackPriceNzd', product: 'DreamLedger Agent Passport + Presence', calls: 100, fixedPrice: 29 },
  'multi-agent-room': { priceKey: 'defaultPackPriceNzd', product: 'DreamLedger Multi-Agent Coordination Room', calls: 50, fixedPrice: 39 },
  'capacity-futures': { priceKey: 'defaultPackPriceNzd', product: 'DreamLedger Capacity Futures (burst window)', calls: 1, fixedPrice: 75 },
  'enterprise-wall': { priceKey: 'defaultPackPriceNzd', product: 'DreamLedger Enterprise Toll Wall (500k calls)', calls: 500000, fixedPrice: 499 },
  'enterprise-pro': { priceKey: 'defaultPackPriceNzd', product: 'DreamLedger Enterprise Pro (2M calls + SLA)', calls: 2000000, fixedPrice: 1499 },
  'white-label': { priceKey: 'defaultPackPriceNzd', product: 'DreamLedger White-Label Route Namespace', calls: 100000, fixedPrice: 999 },
  road: { priceKey: 'defaultPackPriceNzd', product: 'DreamLedger Namespaced Toll Road Access (100 calls)', calls: 100, fixedPrice: RoadFactory.ROAD_PRICE_NZD },
  'sla-credit': { priceKey: 'defaultPackPriceNzd', product: 'DreamLedger SLA Credit Pack', calls: 10, fixedPrice: 250 },
  trinity: { priceKey: 'defaultPackPriceNzd', product: 'DreamLedger Trinity Run (Elohim+Gauntlet+Bridge)', calls: 25, fixedPrice: 49 },
  nexus: { priceKey: 'defaultPackPriceNzd', product: 'DreamLedger Toll Nexus (Truth+Gauntlet+Agent Bridge)', calls: 25, fixedPrice: 49 }
};

function stripeForm(values){const form=new URLSearchParams();for(const [k,v] of Object.entries(values))form.set(k,String(v));return form;}
function safeAttribution(value,fallback){const s=String(value||'').trim();return /^[A-Za-z0-9_-]{1,64}$/.test(s)?s:fallback;}
function priceFor(scope){
  const cfg=Toll.config();
  const def=SCOPES[scope];
  if(!def) return 0;
  if(def.fixedPrice != null) return Number(def.fixedPrice);
  return Number(cfg[def.priceKey] || 0);
}

function passportSecret(){
  return String(process.env.DREAMLEDGER_TOLL_KEY_SECRET||'');
}
function signPassport(body){
  return crypto.createHmac('sha256', passportSecret()).update(body).digest('base64url');
}
function issuePassportToken({agentId, passportId, issuedByKeyId, ttlHours=24}){
  const now=new Date();
  const exp=new Date(now.getTime()+(ttlHours*3600000)).toISOString();
  const payload={schema:'dreamledger/agent-passport/v1',passport_id:passportId,agent_id:agentId,issued_at:now.toISOString(),expires_at:exp,issued_by_key:issuedByKeyId||null,presence:'ATTESTED'};
  const body=Buffer.from(JSON.stringify(payload),'utf8').toString('base64url');
  return 'dlp_'+body+'.'+signPassport(body);
}
function verifyPassportToken(token){
  if(!passportSecret()) return {ok:false,error:'passport_not_configured'};
  const raw=String(token||'').trim();
  const parts=raw.split('.');
  if(parts.length!==2||!parts[0].startsWith('dlp_')) return {ok:false,error:'invalid_passport'};
  const body=parts[0].slice(4);
  const sig=parts[1];
  const expected=signPassport(body);
  const a=Buffer.from(sig); const b=Buffer.from(expected);
  if(a.length!==b.length||!crypto.timingSafeEqual(a,b)) return {ok:false,error:'invalid_passport'};
  let payload;
  try{payload=JSON.parse(Buffer.from(body,'base64url').toString('utf8'));}catch{return {ok:false,error:'invalid_passport'};}
  if(payload.schema!=='dreamledger/agent-passport/v1') return {ok:false,error:'unsupported_passport_schema'};
  if(payload.expires_at&&Date.parse(payload.expires_at)<=Date.now()) return {ok:false,error:'passport_expired'};
  return {ok:true,payload};
}

async function createCheckout(scope, roadId=null, attribution={}){
  if(!TOLL_CHECKOUT_ENABLED)throw Object.assign(new Error('Toll checkout is disabled until payment-to-delivery acceptance passes'),{statusCode:503});
  if(scope==='road'){
    if(!RoadFactory.getRoad(roadId))throw Object.assign(new Error('Unknown toll road'),{statusCode:404});
    throw Object.assign(new Error('Road checkout disabled until durable per-key quota accounting is available'),{statusCode:503});
  }
  const priceNzd=priceFor(scope);
  if(!Toll.configured())throw Object.assign(new Error('Toll key issuance is not configured'),{statusCode:503});
  if(!STRIPE_SECRET_KEY||!(priceNzd>0))throw Object.assign(new Error('Toll checkout is not configured'),{statusCode:503});
  const def=SCOPES[scope];
  const sessionId='toll_'+crypto.randomUUID();
  const productName=def.product;
  const response=await fetch('https://api.stripe.com/v1/checkout/sessions',{method:'POST',headers:{Authorization:'Bearer '+STRIPE_SECRET_KEY,'Content-Type':'application/x-www-form-urlencoded','Idempotency-Key':'dreamledger-toll-'+sessionId},body:stripeForm({mode:'payment',client_reference_id:sessionId,'line_items[0][price_data][currency]':'nzd','line_items[0][price_data][unit_amount]':Math.round(priceNzd*100),'line_items[0][price_data][product_data][name]':productName,'line_items[0][quantity]':'1','metadata[toll_scope]':scope,'metadata[toll_request_id]':sessionId,'metadata[toll_price_nzd]':String(priceNzd),'metadata[toll_product]':productName,'metadata[referrer_id]':safeAttribution(attribution.referrer_id,'organic'),'metadata[campaign_id]':safeAttribution(attribution.campaign_id,'direct'),'payment_intent_data[metadata][toll_scope]':scope,'payment_intent_data[metadata][toll_request_id]':sessionId,'payment_intent_data[metadata][referrer_id]':safeAttribution(attribution.referrer_id,'organic'),'payment_intent_data[metadata][campaign_id]':safeAttribution(attribution.campaign_id,'direct'),'metadata[road_id]':roadId||'','payment_intent_data[metadata][road_id]':roadId||'',success_url:PUBLIC_BASE+(scope==='bridge-events'?'/agent-bridge.html':'/toll-road')+'?checkout=success&scope='+scope+(roadId?'&road_id='+encodeURIComponent(roadId):'')+'&session_id={CHECKOUT_SESSION_ID}',cancel_url:PUBLIC_BASE+'/toll-road?checkout=cancelled&scope='+scope})});
  const text=await response.text();let data;try{data=JSON.parse(text||'{}')}catch{data={}};
  if(!response.ok)throw Object.assign(new Error(data?.error?.message||'Stripe checkout creation failed'),{statusCode:502});
  return data;
}

async function redeem(scope,sessionId,roadId=null){
  if(scope==='road'){
    if(!RoadFactory.getRoad(roadId))throw Object.assign(new Error('Unknown toll road'),{statusCode:404});
    throw Object.assign(new Error('Road redemption disabled until durable per-key quota accounting is available'),{statusCode:503});
  }
  if(!STRIPE_SECRET_KEY)throw Object.assign(new Error('Stripe secret key is not configured'),{statusCode:503});
  const response=await fetch('https://api.stripe.com/v1/checkout/sessions/'+encodeURIComponent(sessionId)+'?expand[]=line_items',{headers:{Authorization:'Bearer '+STRIPE_SECRET_KEY}});
  const text=await response.text();let data;try{data=JSON.parse(text||'{}')}catch{data={}};
  if(!response.ok)throw Object.assign(new Error(data?.error?.message||'Stripe session lookup failed'),{statusCode:502});
  if(data.livemode!==true||data.payment_status!=='paid'||data.metadata?.toll_scope!==scope)throw Object.assign(new Error('Settled payment required before key issuance'),{statusCode:402});
  if(scope==='road'&&data.metadata?.road_id!==roadId)throw Object.assign(new Error('Road attribution mismatch'),{statusCode:409});
  const expectedPriceNzd=priceFor(scope);
  const expectedAmount=Math.round(expectedPriceNzd*100);
  const line=data.line_items?.data?.[0];
  if(!line || Number(line.amount_total ?? line.price?.unit_amount ?? 0)!==expectedAmount || String(data.currency||'').toLowerCase()!=='nzd')throw Object.assign(new Error('Checkout amount or currency attribution mismatch'),{statusCode:409});
  const def=scope==='road'?{calls:RoadFactory.CALLS_PER_ROAD}:(SCOPES[scope]||{calls:100});
  const createdAt = Number(data.created || 0) * 1000;
  const expiresAt = createdAt > 0 ? new Date(createdAt + 30 * 86400000).toISOString() : undefined;
  if (expiresAt && Date.parse(expiresAt) <= Date.now()) throw Object.assign(new Error('Paid entitlement expired'),{statusCode:410});
  const keyId='TOLL_'+String(sessionId).slice(-24);
  if(scope==='toll-probe'){
    const paymentIntentId=typeof data.payment_intent==='string'?data.payment_intent:(data.payment_intent?.id||'');
    await TollEntitlementLedger.registerProbeEntitlement({
      keyId,
      checkoutSessionId:sessionId,
      paymentIntentId,
      scope,
      callsGranted:def.calls,
      expiresAt:expiresAt||new Date(Date.now()+30*86400000).toISOString(),
      livemode:data.livemode===true,
      amountMinor:Number(data.amount_total),
      currency:String(data.currency||'').toLowerCase()
    });
  }
  return {status:'ENTITLED',key:Toll.issueKey({keyId,tier:scope,roadId:roadId||null,callsRemaining:def.calls,expiresAt,reference:sessionId}),attribution:{referrer_id:safeAttribution(data.metadata?.referrer_id,'organic'),campaign_id:safeAttribution(data.metadata?.campaign_id,'direct')}};
}

const probeClaims=new Map();
const probeClaimInFlight=new Map();

async function claimProbeOnce(sessionId,keyId){
  const id=String(sessionId||'').trim();
  if(!id||id.length>255)throw Object.assign(new Error('paid_checkout_session_reference_required'),{statusCode:401});
  if(!STRIPE_SECRET_KEY)throw Object.assign(new Error('Stripe secret key is not configured'),{statusCode:503});
  if(probeClaims.has(id))return {...probeClaims.get(id),replayed:true};
  const existing=probeClaimInFlight.get(id);
  if(existing){const prior=await existing;return {...prior,replayed:true};}
  const task=(async()=>{
    const response=await fetch('https://api.stripe.com/v1/checkout/sessions/'+encodeURIComponent(id),{headers:{Authorization:'Bearer '+STRIPE_SECRET_KEY}});
    const raw=await response.text();let data;try{data=JSON.parse(raw||'{}')}catch{data={}};
    if(!response.ok)throw Object.assign(new Error(data?.error?.message||'Stripe session lookup failed'),{statusCode:502});
    if(data.livemode!==true||data.payment_status!=='paid'||data.metadata?.toll_scope!=='toll-probe'||Number(data.amount_total)!==50||String(data.currency||'').toLowerCase()!=='nzd')throw Object.assign(new Error('settled_NZD_0.50_toll_probe_payment_required'),{statusCode:402});
    const attribution={referrer_id:safeAttribution(data.metadata?.referrer_id,'organic'),campaign_id:safeAttribution(data.metadata?.campaign_id,'direct')};
    if(data.metadata?.probe_consumed==='true'){
      if(String(data.metadata?.probe_key_id||'')!==String(keyId||''))throw Object.assign(new Error('probe_already_consumed_by_another_key'),{statusCode:409});
      const claim={attribution,consumed_at:String(data.metadata?.probe_consumed_at||new Date().toISOString()),replayed:true};
      probeClaims.set(id,claim);
      return claim;
    }
    const consumedAt=new Date().toISOString();
    const update=await fetch('https://api.stripe.com/v1/checkout/sessions/'+encodeURIComponent(id),{
      method:'POST',
      headers:{Authorization:'Bearer '+STRIPE_SECRET_KEY,'Content-Type':'application/x-www-form-urlencoded','Idempotency-Key':'dreamledger-probe-consume-'+id},
      body:stripeForm({'metadata[probe_consumed]':'true','metadata[probe_consumed_at]':consumedAt,'metadata[probe_key_id]':String(keyId||'').slice(0,128)})
    });
    const updateRaw=await update.text();let updated;try{updated=JSON.parse(updateRaw||'{}')}catch{updated={}};
    if(!update.ok||updated.metadata?.probe_consumed!=='true'||String(updated.metadata?.probe_key_id||'')!==String(keyId||''))throw Object.assign(new Error(updated?.error?.message||'durable_probe_claim_failed'),{statusCode:502});
    const claim={attribution,consumed_at:String(updated.metadata?.probe_consumed_at||consumedAt),replayed:false};
    probeClaims.set(id,claim);
    return claim;
  })();
  probeClaimInFlight.set(id,task);
  try{return await task;}finally{probeClaimInFlight.delete(id);}
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
    req.on('data',chunk=>{raw+=chunk;if(raw.length>500000){reject(Object.assign(new Error('Request too large'),{statusCode:413}));req.destroy();}});
    req.on('end',()=>{try{resolve(JSON.parse(raw||'{}'));}catch{reject(Object.assign(new Error('Invalid JSON'),{statusCode:400}));}});
    req.on('error',reject);
  });
}
function authorize(req,tier,roadId=null){
  const checked=Toll.verifyKey(Toll.headerKey(req),{requiredTier:tier,requiredRoadId:roadId});
  if(!checked.ok)throw Object.assign(new Error(checked.error),{statusCode:checked.error==='toll_wall_not_configured'?503:401});
  return checked.payload;
}
function meterResult(key, service, extra){
  return Object.assign({schema:'dreamledger/toll-metered-result/v1',key_id:key.key_id,service,accepted:true,economic_truth_unchanged:true,received_at:new Date().toISOString()},extra||{});
}

const LOCAL_HEARTBEAT_TTL_MS = 5 * 60 * 1000;
let latestLocalHeartbeat = null;

function configuredLocalHeartbeatToken() {
  const value = String(process.env.LOCAL_HEARTBEAT_TOKEN || '');
  return value.length >= 32 ? value : '';
}

function matchesLocalHeartbeatToken(req, expected) {
  const match = String(req.headers && req.headers.authorization || '').match(/^Bearer\s+(.+)$/i);
  if (!match || !expected) return false;
  const supplied = Buffer.from(match[1], 'utf8');
  const canonical = Buffer.from(expected, 'utf8');
  return supplied.length === canonical.length && crypto.timingSafeEqual(supplied, canonical);
}

function localHeartbeatSnapshot(now = Date.now()) {
  if (!configuredLocalHeartbeatToken()) {
    return {
      schema: 'dreamledger/local-heartbeat-status/v1',
      status: 'NOT_CONFIGURED',
      online: false,
      received_at: null,
      checked_at: new Date(now).toISOString(),
      ttl_seconds: LOCAL_HEARTBEAT_TTL_MS / 1000,
      note: 'A dedicated LOCAL_HEARTBEAT_TOKEN of at least 32 characters must be configured. No local status is inferred.'
    };
  }
  const receivedMs = latestLocalHeartbeat ? Date.parse(latestLocalHeartbeat.received_at) : NaN;
  const fresh = Number.isFinite(receivedMs) && now - receivedMs >= 0 && now - receivedMs < LOCAL_HEARTBEAT_TTL_MS;
  if (!fresh) {
    return {
      schema: 'dreamledger/local-heartbeat-status/v1',
      status: 'OFFLINE_OR_STALE',
      online: false,
      received_at: latestLocalHeartbeat && latestLocalHeartbeat.received_at || null,
      checked_at: new Date(now).toISOString(),
      ttl_seconds: LOCAL_HEARTBEAT_TTL_MS / 1000,
      note: 'No fresh authenticated heartbeat. This does not distinguish powered-off hardware from sleep, network, task, or local runtime failure.'
    };
  }
  return {
    schema: 'dreamledger/local-heartbeat-status/v1',
    status: 'ONLINE',
    online: true,
    received_at: latestLocalHeartbeat.received_at,
    checked_at: new Date(now).toISOString(),
    ttl_seconds: LOCAL_HEARTBEAT_TTL_MS / 1000,
    lm_studio: latestLocalHeartbeat.lm_studio,
    tri_llm: latestLocalHeartbeat.tri_llm,
    capacity: latestLocalHeartbeat.capacity,
    loaded_model_count: latestLocalHeartbeat.loaded_model_count,
    note: 'Operational presence only. This is not payment, fulfilment, capability-correctness, or revenue evidence.'
  };
}

async function handle(req,res,path){
  if(path==='/api/toll/v1/local-heartbeat'&&req.method==='GET') {
    return send(res,200,localHeartbeatSnapshot());
  }

  if(path==='/api/toll/v1/local-heartbeat'&&req.method==='POST') {
    const token=configuredLocalHeartbeatToken();
    if(!token) return send(res,503,{schema:'dreamledger/local-heartbeat-status/v1',error:'local_heartbeat_not_configured',required_env:'LOCAL_HEARTBEAT_TOKEN'});
    if(!matchesLocalHeartbeatToken(req,token)) return send(res,401,{schema:'dreamledger/local-heartbeat-status/v1',error:'invalid_local_heartbeat_token'});
    const body=await readJson(req).catch(error=>({__error:error}));
    if(body&&body.__error) return send(res,body.__error.statusCode||400,{schema:'dreamledger/local-heartbeat-status/v1',error:body.__error.message||'invalid_json'});
    if(!body||typeof body!=='object'||Array.isArray(body)) return send(res,400,{error:'heartbeat_object_required'});
    if(typeof body.ts!=='string'||!Number.isFinite(Date.parse(body.ts))) return send(res,400,{error:'valid_iso8601_ts_required'});
    const sourceTs=Date.parse(body.ts),now=Date.now();
    if(sourceTs<now-10*60*1000||sourceTs>now+5*60*1000) return send(res,400,{error:'heartbeat_timestamp_stale_or_future'});
    if(typeof body.lm_studio!=='boolean') return send(res,400,{error:'lm_studio_boolean_required'});
    if(body.tri_llm!=null&&typeof body.tri_llm!=='boolean') return send(res,400,{error:'tri_llm_must_be_boolean'});
    const capacity=body.capacity==null?(body.lm_studio?'available':'offline'):String(body.capacity);
    if(!['available','busy','offline'].includes(capacity)) return send(res,400,{error:'invalid_capacity'});
    const modelList=Array.isArray(body.models)?body.models.filter(x=>typeof x==='string').slice(0,20):[];
    latestLocalHeartbeat={
      received_at:new Date(now).toISOString(),
      source_ts:new Date(sourceTs).toISOString(),
      lm_studio:body.lm_studio,
      tri_llm:body.tri_llm===true,
      capacity,
      loaded_model_count:modelList.length
    };
    return send(res,200,{
      schema:'dreamledger/local-heartbeat-ack/v1',
      status:'ACCEPTED',
      received_at:latestLocalHeartbeat.received_at,
      ttl_seconds:LOCAL_HEARTBEAT_TTL_MS/1000,
      economic_truth_unchanged:true,
      public_posts:false,
      payments_created:false
    });
  }
  if(path==='/api/toll/v1/manifest'&&req.method==='GET')return send(res,200,Toll.publicManifest([{id:'ROAD-METER-10000',route:'/api/toll/v1/roads/{road_id}',scope:'road',status:'CATALOGUED_PENDING_DURABLE_QUOTA_LEDGER',checkout_configured:false,price_nzd:null,proposed_price_nzd:RoadFactory.ROAD_PRICE_NZD,description:'10,000 logical road IDs. Paid execution remains disabled until durable per-key quota accounting is available.',road_instances:RoadFactory.ROAD_COUNT,calls_per_pack:null,proposed_calls_per_pack:RoadFactory.CALLS_PER_ROAD,checkout_route:null,catalog_endpoint:'/api/toll/v1/roads?offset=0&limit=100'}]));

  if(path==='/api/toll/v1/roads'&&req.method==='GET'){
    const u=new URL(req.url,'https://dreamledger.org');
    const offset=Number(u.searchParams.get('offset')||0);
    const limit=Number(u.searchParams.get('limit')||50);
    const page=RoadFactory.listRoads({offset,limit});
    return send(res,page.error?400:200,{schema:'dreamledger/toll-road-catalog/v1',...page});
  }

  const roadMatch=path.match(/^\/api\/toll\/v1\/roads\/(ROAD-\d{6})$/);
  if(roadMatch&&req.method==='GET'){
    const road=RoadFactory.getRoad(roadMatch[1]);
    return road?send(res,200,{schema:'dreamledger/toll-road/v1',...road}):send(res,404,{error:'unknown_toll_road'});
  }
  if(roadMatch&&req.method==='POST'){
    const road=RoadFactory.getRoad(roadMatch[1]);
    if(!road)return send(res,404,{error:'unknown_toll_road'});
    return send(res,503,{error:'durable_quota_ledger_required',road_id:road.road_id,note:'No payload was processed. Paid execution is disabled until per-key usage can be durably enforced.'});
  }

  if(path.startsWith('/api/toll/v1/checkout/road/')&&(req.method==='GET'||req.method==='POST')){
    const roadId=path.split('/').pop();
    if(!RoadFactory.getRoad(roadId))return send(res,404,{error:'unknown_toll_road'});
    try{
      const session=await createCheckout('road',roadId);
      if(req.method==='GET'){res.writeHead(303,{Location:session.url,'Cache-Control':'no-store'});res.end();return true;}
      return send(res,200,{schema:'dreamledger/toll-checkout/v1',scope:'road',road_id:roadId,session_id:session.id,url:session.url,amount_nzd:RoadFactory.ROAD_PRICE_NZD,calls_per_pack:RoadFactory.CALLS_PER_ROAD,note:'Pay on Stripe. Redeem only after a live settled payment; key is scoped to this road ID.'});
    }catch(e){return send(res,e.statusCode||502,{error:e.message});}
  }

  if(path.startsWith('/api/toll/v1/redeem/road/')&&(req.method==='GET'||req.method==='POST')){
    const roadId=path.split('/').pop();
    const u=new URL(req.url,'https://dreamledger.org');
    let sessionId=u.searchParams.get('session_id');
    if(!sessionId&&req.method==='POST'){
      try{const body=await readJson(req);sessionId=body&&body.session_id?String(body.session_id):null;}catch(e){return send(res,e.statusCode||400,{error:e.message});}
    }
    if(!RoadFactory.getRoad(roadId)||!sessionId)return send(res,400,{error:'valid_road_and_session_id_required'});
    try{return send(res,200,{schema:'dreamledger/toll-redeem/v1',scope:'road',road_id:roadId,...(await redeem('road',sessionId,roadId))});}catch(e){return send(res,e.statusCode||502,{error:e.message});}
  }

  if(path==='/api/toll/v1/passport/verify'&&req.method==='POST'){
    const body=await readJson(req).catch(()=>({}));
    const token=body.passport||body.token||body.passport_token||'';
    const result=verifyPassportToken(token);
    if(!result.ok)return send(res,401,{schema:'dreamledger/agent-passport-verify/v1',ok:false,error:result.error});
    return send(res,200,{schema:'dreamledger/agent-passport-verify/v1',ok:true,passport_id:result.payload.passport_id,agent_id:result.payload.agent_id,presence:result.payload.presence,expires_at:result.payload.expires_at,note:'Verification only. Does not grant authority or create economic truth.'});
  }

  if(path.startsWith('/api/toll/v1/checkout/')&&(req.method==='GET'||req.method==='POST')){
    const scope=path.split('/').pop();
    if(!SCOPES[scope])return send(res,404,{error:'unknown_toll_scope'});
    try{
      const u=new URL(req.url,'https://dreamledger.org');
      const attribution={referrer_id:safeAttribution(u.searchParams.get('ref'),'organic'),campaign_id:safeAttribution(u.searchParams.get('c'),'direct')};
      const session=await createCheckout(scope,null,attribution);
      if(req.method==='GET'){res.writeHead(303,{Location:session.url,'Cache-Control':'no-store'});res.end();return true;}
      return send(res,200,{schema:'dreamledger/toll-checkout/v1',scope,session_id:session.id,url:session.url,amount_nzd:priceFor(scope),note:'Pay on Stripe. On success, redeem with session_id to receive the access key. No key without settled payment.'});
    }catch(e){return send(res,e.statusCode||502,{error:e.message});}
  }

  if(path.startsWith('/api/toll/v1/redeem/')&&(req.method==='GET'||req.method==='POST')){
    const scope=path.split('/').pop();
    const u=new URL(req.url,'https://dreamledger.org');
    let sessionId=u.searchParams.get('session_id');
    if(!sessionId&&req.method==='POST'){
      try{const body=await readJson(req);sessionId=body&&body.session_id?String(body.session_id):null;}catch(e){return send(res,e.statusCode||400,{error:e.message});}
    }
    if(!SCOPES[scope]||!sessionId)return send(res,400,{error:'scope_and_session_id_required'});
    try{return send(res,200,{schema:'dreamledger/toll-redeem/v1',...(await redeem(scope,sessionId))});}catch(e){return send(res,e.statusCode||502,{error:e.message});}
  }

  if(path==='/api/toll/v1/probe'&&req.method==='POST'){
    const key=authorize(req,'toll-probe');
    try{
      const claim=await claimProbeOnce(key.reference,key.key_id);
      const quota=await TollEntitlementLedger.consumeProbeQuota({keyId:key.key_id,idempotencyKey:'toll-probe:'+String(key.reference)});
      const receipt={receipt_id:'PROBE-'+crypto.createHash('sha256').update(String(key.reference)).digest('hex').slice(0,24),probe_id:'TOLL-PROBE-50C',route:'/api/toll/v1/probe',price_nzd:0.50,result:'LIVE_TOLL_WALL_REACHED',issued_at:claim.consumed_at,attribution:claim.attribution,replayed:claim.replayed===true||quota.replayed===true,calls_remaining:Number(quota.calls_remaining),quota_ledger:'DURABLE',note:'One settled NZ$0.50 probe consumed through the durable quota ledger. Retries return the same receipt without decrementing quota again. Receipt is an API response; it is not an Ed25519 signature.'};
      return send(res,200,meterResult(key,'TOLL-PROBE',receipt));
    }catch(error){
      return send(res,Number(error&&error.statusCode)||502,{error:String(error&&error.message||'probe_claim_failed'),service:'TOLL-PROBE'});
    }
  }

  if(path==='/api/toll/v1/gauntlet'&&req.method==='POST'){
    const key=authorize(req,'gauntlet');
    const candidate=await readJson(req);
    const proof=runGauntlet(candidate);
    return send(res,proof.status==='PASS'?200:422,{schema:'dreamledger/toll-gauntlet-result/v1',key_id:key.key_id,service:'DECISION-CHECK',human_minutes:0,public_execution:'AUTOMATED_DIGITAL_RESULT',result:proof});
  }

  if(path==='/api/toll/v1/truth'&&req.method==='POST'){
    const key=authorize(req,'truth');
    const body=await readJson(req);
    const evidence=Array.isArray(body.evidence)?body.evidence:[];
    const contradictions=Array.isArray(body.contradictions)?body.contradictions:[];
    const unresolved=Array.isArray(body.unresolved)?body.unresolved:[];
    return send(res,200,{schema:'dreamledger/toll-truth-input/v1',key_id:key.key_id,service:'EVIDENCE-CHECK',role:'ELOHIM',verdict:contradictions.length?'CONTRADICTED':(evidence.length?'OBSERVED':'UNVERIFIED'),evidence_count:evidence.length,contradiction_count:contradictions.length,unresolved_count:unresolved.length,economic_truth_unchanged:true,note:'Elohim truth boundary. Classifies evidence only. Does not invent payment, buyer, or settlement facts.'});
  }

  // TOLL NEXUS — replacement for the old Gold Button / Trinity presentation layer
  if(path==='/api/toll/v1/nexus'&&req.method==='POST'){
    const key=authorize(req,'nexus');
    const body=await readJson(req).catch(()=>({}));
    const result=TollNexus.runNexus(body,{key_id:key.key_id});
    const code=result.synergy==='ALIGNED'?200:422;
    return send(res,code,result);
  }

  // Backward-compatible Trinity road. New traffic should use Toll Nexus.
  if(path==='/api/toll/v1/trinity'&&req.method==='POST'){
    const key=authorize(req,'trinity');
    const body=await readJson(req).catch(()=>({}));
    const result=Trinity.runTrinity(body,{key_id:key.key_id});
    const code=result.synergy==='ALIGNED'?200:422;
    return send(res,code,result);
  }

  if(path==='/api/toll/v1/agent-passport'&&req.method==='POST'){
    const key=authorize(req,'agent-passport');
    const body=await readJson(req).catch(()=>({}));
    const agentId=String(body.agent_id||body.id||'anonymous').slice(0,64);
    const passportId='PASS-'+crypto.randomUUID().slice(0,12).toUpperCase();
    const passportToken=issuePassportToken({agentId,passportId,issuedByKeyId:key.key_id,ttlHours:Number(body.ttl_hours)||24});
    return send(res,200,meterResult(key,'AGENT-PASSPORT',{passport_id:passportId,agent_id:agentId,presence:'ATTESTED',passport:passportToken,verify_url:PUBLIC_BASE+'/api/toll/v1/passport/verify',note:'Signed presence attestation. Other agents can POST the passport token to verify_url. Does not create economic truth or authority.'}));
  }

  if(path==='/api/toll/v1/multi-agent-room'&&req.method==='POST'){
    const key=authorize(req,'multi-agent-room');
    const body=await readJson(req).catch(()=>({}));
    const roomId='ROOM-'+crypto.randomUUID().slice(0,10).toUpperCase();
    return send(res,200,meterResult(key,'MULTI-AGENT-ROOM',{room_id:roomId,max_agents:Number(body.max_agents)||8,note:'Coordination room opened under entitlement. No side effects outside the room contract.'}));
  }

  const thinMeters = {
    '/api/toll/v1/bridge-events': 'bridge-events',
    '/api/toll/v1/micro-ingest': 'micro-ingest',
    '/api/toll/v1/job-claim': 'job-claim',
    '/api/toll/v1/heartbeat': 'heartbeat',
    '/api/toll/v1/note-write': 'note-write',
    '/api/toll/v1/route-lease': 'route-lease',
    '/api/toll/v1/route-exclusive': 'route-exclusive',
    '/api/toll/v1/route-shared': 'route-shared',
    '/api/toll/v1/gauntlet-pack': 'gauntlet-pack',
    '/api/toll/v1/gauntlet-rush': 'gauntlet-rush',
    '/api/toll/v1/gauntlet-async': 'gauntlet-async',
    '/api/toll/v1/trust-attest': 'trust-attest',
    '/api/toll/v1/trust-agent': 'trust-agent',
    '/api/toll/v1/seat-agent': 'seat-agent',
    '/api/toll/v1/org-key': 'org-key',
    '/api/toll/v1/priority': 'priority',
    '/api/toll/v1/prepaid-10k': 'prepaid-10k',
    '/api/toll/v1/webhook-egress': 'webhook-egress',
    '/api/toll/v1/audit-export': 'audit-export',
    '/api/toll/v1/shadow-route': 'shadow-route',
    '/api/toll/v1/quarantine': 'quarantine',
    '/api/toll/v1/academic': 'academic',
    '/api/toll/v1/transparency': 'transparency',
    '/api/toll/v1/capacity-futures': 'capacity-futures',
    '/api/toll/v1/enterprise-wall': 'enterprise-wall',
    '/api/toll/v1/enterprise-pro': 'enterprise-pro',
    '/api/toll/v1/white-label': 'white-label',
    '/api/toll/v1/sla-credit': 'sla-credit'
  };
  if(req.method==='POST' && thinMeters[path]){
    const tier = thinMeters[path];
    const key = authorize(req, tier);
    const body = await readJson(req).catch(()=>({}));
    if (tier === 'bridge-events') {
      const idempotencyKey = String(req.headers['idempotency-key'] || body.idempotency_key || '').trim();
      const payload = body && typeof body.payload === 'object' && !Array.isArray(body.payload)
        ? body.payload
        : body && typeof body.event === 'object' && !Array.isArray(body.event)
          ? body.event
          : body && typeof body === 'object' && !Array.isArray(body)
            ? Object.fromEntries(Object.entries(body).filter(([name]) => name !== 'idempotency_key'))
            : null;
      try {
        const receipt = await AgentBridgeEventLedger.acceptEvent({ keyId: key.key_id, idempotencyKey, payload });
        return send(res,200,{...meterResult(key,'AGENT-BRIDGE-EVENTS',{...receipt}),economic_truth_unchanged:true});
      } catch (error) {
        return send(res,Number(error && error.statusCode) || 500,{error:String(error && error.message || 'agent_bridge_event_rejected'),service:'AGENT-BRIDGE-EVENTS'});
      }
    }
    return send(res,200,meterResult(key, tier.toUpperCase(), {payload_keys: typeof body==='object' ? Object.keys(body) : []}));
  }

  if(path==='/api/toll/v1/key/check'&&req.method==='GET'){
    const key=authorize(req,null);
    return send(res,200,{schema:'dreamledger/toll-key-check/v1',key_id:key.key_id,tier:key.tier,expires_at:key.expires_at,calls_remaining:key.calls_remaining});
  }

  return false;
}

module.exports={handle};
