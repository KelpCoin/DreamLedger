'use strict';

const crypto=require('crypto');
const {run:runGauntlet}=require('../gauntlet/CandidateGauntlet');
const Toll=require('../runtime/TollRoad');
const Trinity=require('../runtime/Trinity');
const TollNexus=require('../runtime/TollNexus');
const STRIPE_SECRET_KEY=String(process.env.STRIPE_SECRET_KEY||process.env.STRIPE_LIVE_SECRET_KEY||'');
const PUBLIC_BASE=String(process.env.PUBLIC_BASE_URL||'https://dreamledger.org').replace(/\/$/,'');
const SUPABASE_URL=String(process.env.SUPABASE_URL||'').replace(/\/$/,'');
const AGENT_BRIDGE_TOKEN=String(process.env.DREAMLEDGER_AGENT_BRIDGE_TOKEN||'');
const AGENT_BRIDGE_PROXY=String(process.env.AGENT_BRIDGE_PROXY_URL|| (SUPABASE_URL ? SUPABASE_URL+'/functions/v1/agent-bridge-proxy' : '')).replace(/\/$/,'');
const BILLABLE_SCOPES={
  '/api/toll/v1/probe':'toll-probe','/api/toll/v1/gauntlet':'gauntlet','/api/toll/v1/truth':'truth',
  '/api/toll/v1/nexus':'nexus','/api/toll/v1/trinity':'trinity','/api/toll/v1/agent-passport':'agent-passport',
  '/api/toll/v1/multi-agent-room':'multi-agent-room','/api/toll/v1/bridge-events':'bridge-events',
  '/api/toll/v1/micro-ingest':'micro-ingest','/api/toll/v1/job-claim':'job-claim','/api/toll/v1/heartbeat':'heartbeat',
  '/api/toll/v1/note-write':'note-write','/api/toll/v1/route-lease':'route-lease','/api/toll/v1/route-exclusive':'route-exclusive',
  '/api/toll/v1/route-shared':'route-shared','/api/toll/v1/gauntlet-pack':'gauntlet-pack','/api/toll/v1/gauntlet-rush':'gauntlet-rush',
  '/api/toll/v1/gauntlet-async':'gauntlet-async','/api/toll/v1/trust-attest':'trust-attest','/api/toll/v1/trust-agent':'trust-agent',
  '/api/toll/v1/seat-agent':'seat-agent','/api/toll/v1/org-key':'org-key','/api/toll/v1/priority':'priority',
  '/api/toll/v1/prepaid-10k':'prepaid-10k','/api/toll/v1/webhook-egress':'webhook-egress','/api/toll/v1/audit-export':'audit-export',
  '/api/toll/v1/shadow-route':'shadow-route','/api/toll/v1/quarantine':'quarantine','/api/toll/v1/academic':'academic',
  '/api/toll/v1/transparency':'transparency','/api/toll/v1/capacity-futures':'capacity-futures',
  '/api/toll/v1/enterprise-wall':'enterprise-wall','/api/toll/v1/enterprise-pro':'enterprise-pro',
  '/api/toll/v1/white-label':'white-label','/api/toll/v1/sla-credit':'sla-credit'
};
const CUSTOMER_BRIDGE_EVENT_TYPES=new Set(['CANDIDATE_FOUND','EVIDENCE_ATTACHED','DELIVERY_ASSESSMENT','COMMERCIAL_ATTACK','COURT_REVIEW']);
const SELLABLE_SCOPES=new Set(['gauntlet','truth','toll-probe','bridge-events','route-lease','micro-ingest','nexus']);
const PUBLISHED_API_PATHS=new Set(['/api/toll/v1/probe','/api/toll/v1/gauntlet','/api/toll/v1/truth','/api/toll/v1/bridge-events','/api/toll/v1/micro-ingest','/api/toll/v1/route-lease','/api/toll/v1/nexus']);
const BRIDGE_EVENT_ROUTING={
  CANDIDATE_FOUND:{lane:'discovery',next:['claude','grok','truth_oracle','gauntlet']},
  EVIDENCE_ATTACHED:{lane:'evidence',next:['truth_oracle','claude']},
  DELIVERY_ASSESSMENT:{lane:'evaluation',next:['claude','truth_oracle']},
  COMMERCIAL_ATTACK:{lane:'evaluation',next:['claude','grok','truth_oracle','gauntlet']},
  COURT_REVIEW:{lane:'evaluation',next:['claude','grok','truth_oracle','gauntlet']}
};
function canonical(value){
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
}
async function bridgeRpc(name,args){
  if(!SUPABASE_URL||!AGENT_BRIDGE_TOKEN||!AGENT_BRIDGE_PROXY)throw Object.assign(new Error('Durable toll metering is not configured'),{statusCode:503});
  const response=await fetch(AGENT_BRIDGE_PROXY,{method:'POST',headers:{'Content-Type':'application/json','x-dreamledger-agent-token':AGENT_BRIDGE_TOKEN},body:JSON.stringify({path:'rpc/'+name,method:'POST',prefer:'return=representation',body:args})});
  const raw=await response.text();let data;try{data=JSON.parse(raw||'null')}catch{data={raw}};
  if(!response.ok)throw Object.assign(new Error('Durable toll metering unavailable'),{statusCode:503});
  if(Array.isArray(data))data=data[0];
  if(data&&data.data!==undefined&&data.status===undefined){
    if(Array.isArray(data.data))data=data.data[0];
    else if(data.data&&typeof data.data==='object')data=data.data;
  }
  return data;
}
async function reserveTollCall(req,res,path,scope,key,body){
  if(['/api/toll/v1/bridge-events','/api/toll/v1/micro-ingest'].includes(path)&&!CUSTOMER_BRIDGE_EVENT_TYPES.has(String(body&&body.event_type||'').toUpperCase())){
    return send(res,400,{error:'unsupported_bridge_event_type',allowed:[...CUSTOMER_BRIDGE_EVENT_TYPES]});
  }
  const idem=String(req.headers['idempotency-key']||req.headers['x-idempotency-key']||'').trim();
  if(!idem)return send(res,400,{error:'idempotency_key_required',message:'Supply Idempotency-Key for every billable API operation.'});
  if(idem.length>200)return send(res,400,{error:'idempotency_key_too_long'});
  const requestHash=crypto.createHash('sha256').update(canonical({method:req.method,path,body})).digest('hex');
  const correlation=String(req.headers['x-correlation-id']||crypto.randomUUID()).slice(0,160);
  let reserved;
  try{
    reserved=await bridgeRpc('reserve_agent_toll_call',{
      p_key_id:key.key_id,p_reference:key.reference||'',p_scope:scope,p_idempotency_key:idem,
      p_request_hash:requestHash,p_call_limit:Number(key.calls_remaining||1),
      p_correlation_id:correlation,p_route:path
    });
  }catch(e){return send(res,503,{error:'toll_meter_unavailable',message:'Paid API work is paused because durable quota enforcement is unavailable.',correlation_id:correlation});}
  if(!reserved||!reserved.status)return send(res,503,{error:'toll_meter_invalid_response',correlation_id:correlation});
  if(reserved.status==='EXHAUSTED')return send(res,402,{error:'quota_exhausted',limit:reserved.limit,used:reserved.used,remaining:0,top_up_route:'/api/toll/v1/manifest'});
  if(reserved.status==='IDEMPOTENCY_CONFLICT')return send(res,409,{error:'idempotency_key_reused_with_different_request'});
  if(reserved.status==='IN_PROGRESS')return send(res,409,{error:'request_in_progress',event_id:reserved.event_id,retry_with_same_idempotency_key:true});
  if(reserved.status==='REPLAY'){
    res.writeHead(Number(reserved.http_status||200),{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Correlation-ID':correlation});
    res.end(JSON.stringify(reserved.response_body||{}));return true;
  }
  if(reserved.status!=='RESERVED')return send(res,503,{error:'toll_reservation_rejected',status:reserved.status,correlation_id:correlation});
  res._tollUsage={event_id:reserved.event_id,remaining:reserved.remaining,route:path};
  req._tollParsedBody=body;
  return false;
}
async function completeTollCall(res,status,body){
  const reservation=res._tollUsage;
  if(!reservation)return;
  res._tollUsage=null;
  // Never persist bearer credentials in the bridge event log. Passport tokens
  // are returned once; a replay is a conflict rather than a second token leak.
  const sensitive=reservation.route==='/api/toll/v1/agent-passport';
  try{
    await bridgeRpc('complete_agent_toll_call',{
      p_event_id:reservation.event_id,
      p_http_status:sensitive?409:status,
      p_response_body:sensitive
        ? {error:'idempotent_replay_secret_not_reissued',message:'The original bearer token is not stored. Use a new authorized issuance request if another token is needed.'}
        : (body&&typeof body==='object'?body:{result:String(body||'')})
    });
  }catch(_){
    // The reservation already counts against the hard quota. If finalization is
    // unavailable, never execute the same idempotency key a second time.
  }
}


const CANONICAL_SKUS={
  'toll-probe':'TOLL-PROBE-1',
  gauntlet:'DECISION-CHECK-100',
  truth:'EVIDENCE-CHECK-100',
  'bridge-events':'AGENT-BRIDGE-STARTER-500',
  'micro-ingest':'MICRO-EVENT-INGEST-200',
  'route-lease':'ROUTE-PASS-30D-5000',
  nexus:'TOLL-NEXUS-25'
};
const SCOPES = {
  gauntlet: { priceKey: 'gauntletPriceNzd', product: 'DreamLedger Decision Check Pack (100 evaluations)', calls: 100, fixedPrice: 19 },
  truth: { priceKey: 'truthPriceNzd', product: 'DreamLedger Evidence Check Pack (100 evaluations)', calls: 100, fixedPrice: 9 },
  'toll-probe': { priceKey: 'defaultPackPriceNzd', product: 'DreamLedger Toll Probe (one live API probe)', calls: 1, fixedPrice: 1 },
  'bridge-events': { priceKey: 'bridgeEventsPriceNzd', product: 'DreamLedger Agent Bridge Starter Pack (500 calls)', calls: 500, fixedPrice: 5 },
  'route-lease': { priceKey: 'routeLeasePriceNzd', product: 'DreamLedger Shared Route Pass (5,000 calls, 30 days)', calls: 5000, fixedPrice: 9 },
  'gauntlet-pack': { priceKey: 'gauntletPackPriceNzd', product: 'DreamLedger Gauntlet Pack (20 approvals)', calls: 20 },
  'micro-ingest': { priceKey: 'defaultPackPriceNzd', product: 'DreamLedger Micro Event Ingest (200)', calls: 200, fixedPrice: 2 },
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
  'sla-credit': { priceKey: 'defaultPackPriceNzd', product: 'DreamLedger SLA Credit Pack', calls: 10, fixedPrice: 250 },
  trinity: { priceKey: 'defaultPackPriceNzd', product: 'DreamLedger Trinity Run (Elohim+Gauntlet+Bridge)', calls: 25, fixedPrice: 49 },
  nexus: { priceKey: 'defaultPackPriceNzd', product: 'DreamLedger Toll Nexus (25 bounded Truth + Gauntlet + Agent Bridge runs)', calls: 25, fixedPrice: 19 }
};

function stripeForm(values){const form=new URLSearchParams();for(const [k,v] of Object.entries(values))form.set(k,String(v));return form;}
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

async function createCheckout(scope){
  const priceNzd=priceFor(scope);
  if(!SELLABLE_SCOPES.has(scope))throw Object.assign(new Error('This toll scope is not published for sale'),{statusCode:404});
  if(!STRIPE_SECRET_KEY||!(priceNzd>0))throw Object.assign(new Error('Toll checkout is not configured'),{statusCode:503});
  if(process.env.DREAMLEDGER_TOLL_CANONICAL_WEBHOOK_READY!=='true')throw Object.assign(new Error('Canonical Stripe revenue webhook has not been verified; checkout remains closed'),{statusCode:503});
  let meter;
  try{meter=await bridgeRpc('agent_toll_meter_health',{});}catch(_){throw Object.assign(new Error('Paid API access is paused until durable quota enforcement is healthy'),{statusCode:503});}
  if(!meter||meter.ready!==true)throw Object.assign(new Error('Paid API access is paused until durable quota enforcement is healthy'),{statusCode:503});
  const def=SCOPES[scope];
  const skuId=CANONICAL_SKUS[scope];
  if(!skuId)throw Object.assign(new Error('Canonical SKU mapping missing'),{statusCode:503});
  const sessionId='toll_'+crypto.randomUUID();
  const productName=def.product;
  const response=await fetch('https://api.stripe.com/v1/checkout/sessions',{method:'POST',headers:{Authorization:'Bearer '+STRIPE_SECRET_KEY,'Content-Type':'application/x-www-form-urlencoded','Idempotency-Key':'dreamledger-toll-'+sessionId},body:stripeForm({mode:'payment',client_reference_id:sessionId,'line_items[0][price_data][currency]':'nzd','line_items[0][price_data][unit_amount]':Math.round(priceNzd*100),'line_items[0][price_data][product_data][name]':productName,'line_items[0][quantity]':'1','metadata[toll_scope]':scope,'metadata[toll_request_id]':sessionId,'metadata[toll_price_nzd]':String(priceNzd),'metadata[toll_product]':productName,'metadata[sku_id]':skuId,'metadata[sku]':skuId,'metadata[silo]':'commerce','metadata[offer_id]':skuId,'payment_intent_data[metadata][toll_scope]':scope,'payment_intent_data[metadata][toll_request_id]':sessionId,'payment_intent_data[metadata][sku_id]':skuId,success_url:PUBLIC_BASE+'/toll-road?checkout=success&scope='+scope+'&session_id={CHECKOUT_SESSION_ID}',cancel_url:PUBLIC_BASE+'/toll-road?checkout=cancelled&scope='+scope})});
  const text=await response.text();let data;try{data=JSON.parse(text||'{}')}catch{data={}};
  if(!response.ok)throw Object.assign(new Error(data?.error?.message||'Stripe checkout creation failed'),{statusCode:502});
  return data;
}

async function redeem(scope,sessionId){
  if(!SELLABLE_SCOPES.has(scope))throw Object.assign(new Error('This toll scope is not published for sale'),{statusCode:404});
  if(!STRIPE_SECRET_KEY)throw Object.assign(new Error('Stripe secret key is not configured'),{statusCode:503});
  if(process.env.DREAMLEDGER_TOLL_CANONICAL_WEBHOOK_READY!=='true')throw Object.assign(new Error('Canonical Stripe revenue webhook has not been verified; entitlement issuance remains closed'),{statusCode:503});
  let meter;
  try{meter=await bridgeRpc('agent_toll_meter_health',{});}catch(_){throw Object.assign(new Error('Entitlement issuance is paused until durable quota enforcement is healthy'),{statusCode:503});}
  if(!meter||meter.ready!==true)throw Object.assign(new Error('Entitlement issuance is paused until durable quota enforcement is healthy'),{statusCode:503});
  const response=await fetch('https://api.stripe.com/v1/checkout/sessions/'+encodeURIComponent(sessionId)+'?expand[]=line_items',{headers:{Authorization:'Bearer '+STRIPE_SECRET_KEY}});
  const text=await response.text();let data;try{data=JSON.parse(text||'{}')}catch{data={}};
  if(!response.ok)throw Object.assign(new Error(data?.error?.message||'Stripe session lookup failed'),{statusCode:502});
  if(data.livemode!==true||data.payment_status!=='paid'||data.metadata?.toll_scope!==scope)throw Object.assign(new Error('Settled payment required before key issuance'),{statusCode:402});
  const skuId=CANONICAL_SKUS[scope];
  if(!skuId||data.metadata?.sku_id!==skuId||data.metadata?.sku!==skuId)throw Object.assign(new Error('Canonical SKU attribution mismatch'),{statusCode:409});
  let canonical;
  try{canonical=await bridgeRpc('get_agent_toll_entitlement',{p_session_id:sessionId,p_sku_id:skuId});}
  catch(_){throw Object.assign(new Error('Canonical paid entitlement is not reachable; no API key issued'),{statusCode:503});}
  if(canonical&&canonical.status==='PENDING')return {status:'PENDING_CANONICAL_ENTITLEMENT',pending:true,reason:canonical.reason||'canonical_webhook_pending',retry_after_seconds:5};
  if(!canonical||canonical.status!=='READY'||canonical.sku_id!==skuId||!canonical.fulfillment_key)throw Object.assign(new Error('Canonical paid entitlement mismatch; no API key issued'),{statusCode:409});
  const metadataPriceNzd=Number(data.metadata?.toll_price_nzd);
  const expectedAmount=Math.round(metadataPriceNzd*100);
  if(String(data.currency||'').toLowerCase()!=='nzd'||!Number.isFinite(metadataPriceNzd)||metadataPriceNzd<=0||
     Number(data.amount_total)!==expectedAmount) {
    throw Object.assign(new Error('Checkout amount attribution mismatch'),{statusCode:409});
  }
  const def=SCOPES[scope]||{calls:100};
  const createdAt=Number(data.created);
  if(!Number.isFinite(createdAt)||createdAt<=0)throw Object.assign(new Error('Checkout creation timestamp missing'),{statusCode:409});
  const issuedAt=new Date(createdAt*1000);
  const expiresAt=new Date(issuedAt.getTime()+30*86400000).toISOString();
  if(Date.parse(expiresAt)<=Date.now())throw Object.assign(new Error('This paid entitlement has expired'),{statusCode:410});
  const key=Toll.issueKey({
    keyId:'TOLL_'+String(sessionId).slice(-24),tier:scope==='route-lease'?'all':scope,callsRemaining:def.calls,
    reference:sessionId,issuedAt,expiresAt
  });
  const keyDigest=crypto.createHash('sha256').update(key).digest('hex');
  let fulfillment;
  try{
    fulfillment=await bridgeRpc('complete_agent_toll_fulfillment',{
      p_session_id:sessionId,p_sku_id:skuId,p_fulfillment_key:canonical.fulfillment_key,
      p_key_id:'TOLL_'+String(sessionId).slice(-24),p_key_digest:keyDigest
    });
  }catch(_){throw Object.assign(new Error('Canonical fulfillment could not be recorded; no API key issued'),{statusCode:503});}
  if(!fulfillment||!['FULFILLED_UNVERIFIED','ALREADY_FULFILLED'].includes(fulfillment.status)){
    if(fulfillment&&fulfillment.status==='PENDING_CANONICAL_ENTITLEMENT')return {status:'PENDING_CANONICAL_ENTITLEMENT',pending:true,retry_after_seconds:5};
    throw Object.assign(new Error('Canonical fulfillment gate rejected key issuance'),{statusCode:409});
  }
  return {status:'ENTITLED',sku_id:skuId,order_id:canonical.order_id,entitlement_id:canonical.entitlement_id,fulfillment_request_id:canonical.fulfillment_request_id,fulfillment_status:fulfillment.status,key};
}

async function send(res,status,body){
  if(res.writableEnded)return true;
  await completeTollCall(res,status,body);
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  res.end(JSON.stringify(body));
  return true;
}
function readJson(req){
  if(Object.prototype.hasOwnProperty.call(req,'_tollParsedBody'))return Promise.resolve(req._tollParsedBody);
  return new Promise((resolve,reject)=>{
    let raw='';
    req.on('data',chunk=>{raw+=chunk;if(raw.length>500000){reject(Object.assign(new Error('Request too large'),{statusCode:413}));req.destroy();}});
    req.on('end',()=>{try{resolve(JSON.parse(raw||'{}'));}catch{reject(Object.assign(new Error('Invalid JSON'),{statusCode:400}));}});
    req.on('error',reject);
  });
}
function authorize(req,tier){
  const checked=Toll.verifyKey(Toll.headerKey(req),tier);
  if(!checked.ok)throw Object.assign(new Error(checked.error),{statusCode:checked.error==='toll_wall_not_configured'?503:401});
  if(tier&&checked.payload.tier==='all'&&!PUBLISHED_API_PATHS.has(String(req.url||'').split('?')[0])){
    throw Object.assign(new Error('toll_key_scope_denied'),{statusCode:403});
  }
  return checked.payload;
}
function meterResult(key, service, extra){
  return Object.assign({schema:'dreamledger/toll-metered-result/v1',key_id:key.key_id,service,accepted:true,economic_truth_unchanged:true,received_at:new Date().toISOString()},extra||{});
}

async function ingestBridgeEvent(key,body,req,res){
  const eventType=String(body&&body.event_type||'').toUpperCase();
  const routing=BRIDGE_EVENT_ROUTING[eventType];
  if(!routing)throw Object.assign(new Error('Unsupported Agent Bridge event type'),{statusCode:400});
  const evidence=body.evidence===undefined?null:body.evidence;
  if(JSON.stringify(evidence||null).length>20000)throw Object.assign(new Error('Evidence payload exceeds 20KB'),{statusCode:413});
  const idem=String(req.headers['idempotency-key']||req.headers['x-idempotency-key']||'');
  const suffix=crypto.createHash('sha256').update(idem).digest('hex').slice(0,24);
  const eventId='TOLL-CUSTOMER-'+String(key.key_id).replace(/[^A-Za-z0-9_-]/g,'').slice(0,48)+'-'+suffix;
  const correlation=String(req.headers['x-correlation-id']||res._tollUsage&&res._tollUsage.event_id||eventId).slice(0,160);
  const payload={
    event_id:eventId,correlation_id:correlation,event_type:eventType,agent:'monetizer',
    subject_type:'paid_api_operation',subject_id:String(key.key_id),
    claim:String(body.claim||body.summary||'').slice(0,4000),evidence,
    requested_action:null,lane:routing.lane,priority:Math.max(0,Math.min(100,Number(body.priority)||50)),
    silo_id:'SILO_AGENT_BRIDGE',source_system:'paid-toll-road',
    economic_intent:'agent_bridge_event_ingest',required_capabilities:[],
    suggested_next_agents:routing.next
  };
  const response=await fetch(PUBLIC_BASE+'/api/agent-bridge/events',{
    method:'POST',
    headers:{'Content-Type':'application/json','x-dreamledger-agent-token':AGENT_BRIDGE_TOKEN},
    body:JSON.stringify(payload)
  });
  const raw=await response.text();let result;try{result=JSON.parse(raw||'{}')}catch{result={raw:raw.slice(0,2000)}}
  if(!response.ok)throw Object.assign(new Error('Agent Bridge event ingestion failed'),{statusCode:502});
  return {
    schema:'dreamledger/toll-bridge-event/v1',accepted:true,event_id:eventId,
    correlation_id:correlation,event_type:eventType,route_lane:routing.lane,
    suggested_next_agents:routing.next,bridge_receipt:result,
    quota:{remaining:res._tollUsage?res._tollUsage.remaining:null}
  };
}

async function handleInternal(req,res,path){
  if(path==='/api/toll/v1/manifest'&&req.method==='GET'){
    const manifest=Toll.publicManifest();
    try{
      const health=await bridgeRpc('agent_toll_meter_health',{});
      const ready=Boolean(health&&health.ready===true);
      manifest.metering_status=ready?'READY':'UNAVAILABLE';
      if(!ready){
        manifest.status='NOT_CONFIGURED';
        manifest.services=manifest.services.map(service=>Object.assign({},service,{checkout_configured:false}));
      }
    }catch(_){
      manifest.status='NOT_CONFIGURED';
      manifest.metering_status='UNAVAILABLE';
      manifest.services=manifest.services.map(service=>Object.assign({},service,{checkout_configured:false}));
    }
    return send(res,200,manifest);
  }

  // Preflight every paid operation through the existing Agent Bridge proxy.
  // No durable quota service means no paid work, never a fake calls_remaining counter.
  const billableScope=BILLABLE_SCOPES[path];
  if(req.method==='POST'&&billableScope){
    let body;
    try{body=await readJson(req);}catch(e){return send(res,e.statusCode||400,{error:e.message||'invalid_json'});}
    const checked=Toll.verifyKey(Toll.headerKey(req),billableScope);
    if(!checked.ok)return send(res,checked.error==='toll_wall_not_configured'?503:401,{error:checked.error});
    if(checked.payload.tier==='all'&&!PUBLISHED_API_PATHS.has(path))return send(res,403,{error:'toll_key_scope_denied'});
    const stopped=await reserveTollCall(req,res,path,billableScope,checked.payload,body);
    if(stopped)return true;
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
      const session=await createCheckout(scope);
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
    try{
      const result=await redeem(scope,sessionId);
      return send(res,result.status==='PENDING_CANONICAL_ENTITLEMENT'?202:200,{schema:'dreamledger/toll-redeem/v1',...result});
    }catch(e){return send(res,e.statusCode||502,{error:e.message});}
  }

  if(path==='/api/toll/v1/probe'&&req.method==='POST'){
    const key=authorize(req,'toll-probe');
    return send(res,200,meterResult(key,'TOLL-PROBE',{probe_id:'TOLL-PROBE-1',route:'/api/toll/v1/probe',price_nzd:1,result:'LIVE_TOLL_WALL_REACHED',issued_at:new Date().toISOString(),note:'This response proves access through the paid toll wall. It does not itself create economic truth.'}));
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
    const passportToken=issuePassportToken({agentId,passportId,issuedByKeyId:key.key_id,ttlHours:Math.max(1,Math.min(168,Number(body.ttl_hours)||24))});
    return send(res,200,meterResult(key,'AGENT-PASSPORT',{passport_id:passportId,agent_id:agentId,presence:'UNVERIFIED',passport:passportToken,verify_url:PUBLIC_BASE+'/api/toll/v1/passport/verify',note:'Signed identity token only. Presence is UNVERIFIED unless separately corroborated; does not create economic truth or authority.'}));
  }

  if(path==='/api/toll/v1/multi-agent-room'&&req.method==='POST'){
    const key=authorize(req,'multi-agent-room');
    const body=await readJson(req).catch(()=>({}));
    const roomId='ROOM-'+crypto.randomUUID().slice(0,10).toUpperCase();
    return send(res,200,meterResult(key,'MULTI-AGENT-ROOM',{room_id:roomId,max_agents:Number(body.max_agents)||8,note:'Coordination room opened under entitlement. No side effects outside the room contract.'}));
  }

  if(['/api/toll/v1/bridge-events','/api/toll/v1/micro-ingest'].includes(path)&&req.method==='POST'){
    const scope=path.endsWith('/micro-ingest')?'micro-ingest':'bridge-events';
    const key=authorize(req,scope);
    const body=await readJson(req);
    const result=await ingestBridgeEvent(key,body,req,res);
    return send(res,201,Object.assign({},result,{service:scope==='micro-ingest'?'MICRO-EVENT-INGEST':'AGENT-BRIDGE-STARTER'}));
  }

  if(path==='/api/toll/v1/route-lease'&&req.method==='POST'){
    const key=authorize(req,'route-lease');
    return send(res,200,meterResult(key,'SHARED-ROUTE-PASS',{
      pass_id:key.key_id,
      valid_until:key.expires_at,
      calls_remaining:res._tollUsage?res._tollUsage.remaining:null,
      access_scope:'all_metered_toll_routes',
      included_routes:[
        '/api/toll/v1/probe',
        '/api/toll/v1/bridge-events',
        '/api/toll/v1/micro-ingest',
        '/api/toll/v1/gauntlet',
        '/api/toll/v1/truth',
        '/api/toll/v1/agent-passport',
        '/api/toll/v1/nexus',
        '/api/toll/v1/trinity',
        '/api/toll/v1/route-lease'
      ],
      overage:'blocked',
      note:'Shared prepaid pass. All billable routes share the same durable 5,000-call allowance.'
    }));
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
    return send(res,200,meterResult(key, tier.toUpperCase(), {payload_keys: typeof body==='object' ? Object.keys(body) : []}));
  }

  if(path==='/api/toll/v1/key/check'&&req.method==='GET'){
    const key=authorize(req,null);
    return send(res,200,{schema:'dreamledger/toll-key-check/v1',key_id:key.key_id,tier:key.tier,expires_at:key.expires_at,calls_remaining:key.calls_remaining});
  }

  return false;
}

async function handle(req,res,path){
  try{
    return await handleInternal(req,res,path);
  }catch(error){
    if(res&&res._tollUsage&&!res.writableEnded){
      return send(res,error.statusCode||500,{
        error:'toll_operation_failed',
        message:'The authorized operation failed; this attempt remains metered and will not be re-executed on an idempotent retry.',
        event_id:res._tollUsage.event_id
      });
    }
    throw error;
  }
}

module.exports={handle,reserveTollCall,bridgeRpc,completeTollCall};
