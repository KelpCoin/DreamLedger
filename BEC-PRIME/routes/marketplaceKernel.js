'use strict';

// Unified B2B + A2A marketplace boundary. Select exactly one ledger backend.
// Supabase mode fails closed; local mode is an explicit single-writer fallback.
// Local JSONL must live on a persistent disk and must not be shared by replicas.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ROOT = path.join(__dirname, '..');
const STORE = String(process.env.MARKETPLACE_STORE || 'supabase').toLowerCase();
const BASE = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const LEDGER_PATH = path.resolve(process.env.MARKETPLACE_LEDGER_PATH || (fs.existsSync('/var/data') ? '/var/data/dreamledger-marketplace/events.jsonl' : path.join(ROOT, 'data', 'marketplace-ledger', 'events.jsonl')));
const MAX_BODY = 96 * 1024;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 12;
const rate = new Map();

function send(res, status, body) {
  if (res.writableEnded) return true;
  res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  res.end(JSON.stringify(body)); return true;
}
function safeText(v, max=2000) { return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').trim().slice(0,max); }
function ipKey(req) {
  // Do not trust arbitrary X-Forwarded-For values unless the hosting proxy is configured to overwrite them.
  return crypto.createHash('sha256').update(String(req.socket?.remoteAddress || 'unknown')).digest('hex').slice(0,24);
}
function rateAllowed(req) {
  const now=Date.now(), key=ipKey(req), old=rate.get(key)||[];
  const fresh=old.filter(t=>now-t<RATE_WINDOW_MS);
  if(fresh.length>=RATE_MAX){rate.set(key,fresh);return false;}
  fresh.push(now);rate.set(key,fresh);
  if(rate.size>5000) for(const [k,v] of rate) if(!v.some(t=>now-t<RATE_WINDOW_MS)) rate.delete(k);
  return true;
}
async function readBody(req) {
  let raw='';
  for await (const chunk of req) { raw+=chunk; if(Buffer.byteLength(raw)>MAX_BODY) throw Object.assign(new Error('Request too large'),{statusCode:413}); }
  try { return raw ? JSON.parse(raw) : {}; } catch { throw Object.assign(new Error('JSON body required'),{statusCode:400}); }
}
async function rpc(name,args) {
  if(!BASE||!SERVICE_KEY) throw Object.assign(new Error('Supabase marketplace backend is not configured'),{statusCode:503});
  const abort=new AbortController(); const timer=setTimeout(()=>abort.abort(),3500);
  try {
    const response=await fetch(BASE+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:SERVICE_KEY,Authorization:'Bearer '+SERVICE_KEY,'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify(args),signal:abort.signal});
    const raw=await response.text(); let data; try{data=raw?JSON.parse(raw):null;}catch{data={message:raw.slice(0,500)};}
    if(!response.ok) throw Object.assign(new Error(data?.message||'Marketplace database request failed'),{statusCode:response.status===404?503:502,detail:data?.code||null});
    return data;
  } catch(err) {
    if(err.name==='AbortError') throw Object.assign(new Error('Marketplace database preflight/request timed out; no automatic backend switch was performed'),{statusCode:503});
    throw err;
  } finally { clearTimeout(timer); }
}
function appendLocal(event) {
  fs.mkdirSync(path.dirname(LEDGER_PATH),{recursive:true});
  let previous=null;
  try {
    const lines=fs.readFileSync(LEDGER_PATH,'utf8').trim().split('\n').filter(Boolean);
    if(lines.length) previous=JSON.parse(lines[lines.length-1]).event_hash;
  } catch(err) { if(err.code!=='ENOENT') throw err; }
  const canonical={...event,previous_hash:previous,recorded_at:new Date().toISOString()};
  canonical.event_hash=crypto.createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
  // Append-only file. fsync makes the write durable on the configured volume, not across replicated instances.
  const fd=fs.openSync(LEDGER_PATH,'a',0o600);
  try { fs.writeSync(fd,JSON.stringify(canonical)+'\n'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  return canonical;
}
function readLocal(limit=100) {
  try {
    return fs.readFileSync(LEDGER_PATH,'utf8').split('\n').filter(Boolean).slice(-limit).reverse().map(line=>JSON.parse(line));
  } catch(err) { if(err.code==='ENOENT') return []; throw err; }
}
function localStatus() {
  const dir=path.dirname(LEDGER_PATH);
  let writable=false;
  try { fs.mkdirSync(dir,{recursive:true}); fs.accessSync(dir,fs.constants.W_OK); writable=true; } catch {}
  return {mode:'local',status:writable?'available':'unavailable',durability:'single-process append-only JSONL; requires persistent disk; not safe for multi-replica or multi-writer deployment',ledger_path_configured:Boolean(process.env.MARKETPLACE_LEDGER_PATH),writable};
}
function publicListing(row) {
  return {id:row.id,title:row.title,description:row.description,category:row.category,listing_type:row.listing_type,price_minor:row.price_minor,currency:row.currency,pricing_model:row.pricing_model,quantity:row.quantity,unit:row.unit,location:row.location||{},attributes:row.attributes||{},created_at:row.created_at};
}
function agentIdentity(req) {
  const header=String(req.headers.authorization||'');
  if(!header.startsWith('Bearer ')) return null;
  const token=header.slice(7);
  let configured={};
  try { configured=JSON.parse(process.env.A2A_AGENT_KEYS_JSON||'{}'); } catch { return null; }
  const hash=crypto.createHash('sha256').update(token).digest('hex');
  return configured[hash]||null;
}
async function status(req,res) {
  if(STORE==='local') return send(res,200,{schema:'DREAMLEDGER/MARKETPLACE-STATUS/v1',...localStatus(),economic_truth:'No revenue is inferred from ledger rows; settlement, fulfillment, delivery and independent evidence must reconcile.'});
  const configured=Boolean(BASE&&SERVICE_KEY);
  let backend='unreachable';
  if(configured) { try { await rpc('marketplace_public_listings',{p_query:'__healthcheck_no_match__',p_category:null,p_listing_type:null,p_limit:1,p_offset:0}); backend='available'; } catch(err) { return send(res,503,{schema:'DREAMLEDGER/MARKETPLACE-STATUS/v1',mode:'supabase',status:'unavailable',configured,error_code:err.statusCode||503,message:'Supabase RPC preflight failed; no fallback or split-brain write attempted.'}); } }
  return send(res,configured?200:503,{schema:'DREAMLEDGER/MARKETPLACE-STATUS/v1',mode:'supabase',status:backend,configured,economic_truth:'No revenue is inferred from ledger rows; settlement, fulfillment, delivery and independent evidence must reconcile.'});
}
function credentialMap(envName, req) {
  const header=String(req.headers.authorization||'');
  if(!header.startsWith('Bearer ')) return null;
  let configured={}; try { configured=JSON.parse(process.env[envName]||'{}'); } catch { return null; }
  const hash=crypto.createHash('sha256').update(header.slice(7)).digest('hex');
  return configured[hash]||null;
}
function supplierIdentity(req){const x=credentialMap('MARKETPLACE_SUPPLIER_KEYS_JSON',req);return x&&x.party_id?x:null;}
function buyerIdentity(req){const x=credentialMap('MARKETPLACE_BUYER_KEYS_JSON',req);return x&&x.party_id?x:null;}
async function rest(resource, options={}) {
  if(!BASE||!SERVICE_KEY) throw Object.assign(new Error('Supabase marketplace backend is not configured'),{statusCode:503});
  const response=await fetch(BASE+'/rest/v1/'+resource,{...options,headers:{apikey:SERVICE_KEY,Authorization:'Bearer '+SERVICE_KEY,'Content-Type':'application/json',Prefer:'return=representation',...(options.headers||{})}});
  const raw=await response.text(); let data; try{data=raw?JSON.parse(raw):null;}catch{data={message:raw.slice(0,500)};}
  if(!response.ok) throw Object.assign(new Error(data?.message||'Marketplace store request failed'),{statusCode:response.status>=400&&response.status<500?400:502});
  return data;
}
function uuid(v){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||''));}

async function handle(req,res,requestPath) {
  if(!requestPath.startsWith('/api/marketplace/v1')) return false;
  if(req.method==='GET'&&requestPath==='/api/marketplace/v1/status') return status(req,res);
  if(req.method==='GET'&&requestPath==='/api/marketplace/v1/discovery') return send(res,200,{
    schema:'DREAMLEDGER/UNIFIED-MARKETPLACE/v1',name:'DreamLedger Transaction Marketplace',
    capabilities:['goods','services','surplus_lots','procurement_rfqs','normalized_offers','evidence_and_trust','transaction_ledger','human_approval','agent_to_agent_intent'],
    endpoints:{status:'/api/marketplace/v1/status',listings:'/api/marketplace/v1/listings',rfqs:'/api/marketplace/v1/rfqs',agentIntent:'/api/marketplace/v1/agent-intents',ledger:'/api/marketplace/v1/ledger'},
    a2a:{authentication:'Bearer token mapped by SHA-256 digest in A2A_AGENT_KEYS_JSON',human_approval_required_for_spend:true,execution_on_intent:false},
    truth_chain:['OBSERVED','QUALIFIED_BUYER_INTENT','AUTHORIZED','PAYMENT_PENDING','SETTLED','FULFILLED','DELIVERED','ACCEPTED','VERIFIED'],
    economic_truth:'Discovery, agent intent, an RFQ, a checkout, and an internal ledger event are not revenue.'
  });
  if(req.method==='GET'&&requestPath==='/api/marketplace/v1/listings') {
    const u=new URL(req.url,'http://localhost'), q=safeText(u.searchParams.get('q'),160), category=safeText(u.searchParams.get('category'),80)||null, type=safeText(u.searchParams.get('type'),40)||null;
    if(STORE==='local') return send(res,200,{schema:'DREAMLEDGER/MARKETPLACE-LISTINGS/v1',listings:readLocal(500).filter(e=>e.event_type==='LISTING_PUBLISHED'&&e.payload?.status==='published').map(e=>e.payload).filter(x=>(!q||JSON.stringify(x).toLowerCase().includes(q.toLowerCase()))&&(!category||x.category===category)&&(!type||x.listing_type===type)).slice(0,50).map(publicListing)});
    const rows=await rpc('marketplace_public_listings',{p_query:q,p_category:category,p_listing_type:type,p_limit:Math.min(Math.max(Number(u.searchParams.get('limit')||24),1),100),p_offset:Math.max(Number(u.searchParams.get('offset')||0),0)});
    return send(res,200,{schema:'DREAMLEDGER/MARKETPLACE-LISTINGS/v1',listings:Array.isArray(rows)?rows:[]});
  }
  if(req.method==='POST'&&requestPath==='/api/marketplace/v1/rfqs') {
    if(!rateAllowed(req)) return send(res,429,{error:'Rate limit reached; retry after one minute.'});
    const b=await readBody(req);
    if(safeText(b.website,200)) return send(res,202,{state:'REJECTED_SPAM'}); // honeypot
    const title=safeText(b.title,180), problem=safeText(b.problem,5000), category=safeText(b.category,80).toLowerCase();
    if(title.length<4||problem.length<10||category.length<2) return send(res,400,{error:'title (4+ chars), problem (10+ chars), and category are required'});
    const key=safeText(req.headers['idempotency-key']||b.idempotency_key,160)||crypto.randomUUID();
    if(key.length<12) return send(res,400,{error:'Idempotency-Key must be at least 12 characters'});
    const min=b.budget_min_minor==null?null:Number(b.budget_min_minor), max=b.budget_max_minor==null?null:Number(b.budget_max_minor);
    if((min!=null&&(!Number.isSafeInteger(min)||min<0))||(max!=null&&(!Number.isSafeInteger(max)||max<0))||(min!=null&&max!=null&&min>max)) return send(res,400,{error:'budget bounds must be non-negative integer minor units and min <= max'});
    const currency=safeText(b.currency||'NZD',3).toUpperCase();
    if(!/^[A-Z]{3}$/.test(currency)) return send(res,400,{error:'currency must be a three-letter ISO code'});
    if(STORE==='local') {
      const existing=readLocal(10000).find(e=>e.idempotency_key===key);
      if(existing) return send(res,200,{duplicate:true,rfq_id:existing.subject_id,state:existing.economic_state});
      const rfqId=crypto.randomUUID();
      const event=appendLocal({event_id:crypto.randomUUID(),idempotency_key:key,event_type:'RFQ_SUBMITTED',subject_type:'rfq',subject_id:rfqId,actor_type:'human',actor_id:null,economic_state:'OBSERVED',payload:{id:rfqId,title,problem_statement:problem,category,budget_min_minor:min,budget_max_minor:max,currency,region:b.region||{},constraints:b.constraints||{},status:'open',authorization_state:'UNAUTHORIZED'}});
      return send(res,201,{rfq_id:rfqId,state:'OBSERVED',event_hash:event.event_hash,message:'RFQ recorded; it has not been matched to suppliers and no response is guaranteed.'});
    }
    const result=await rpc('marketplace_create_public_rfq',{p_idempotency_key:key,p_title:title,p_problem:problem,p_category:category,p_budget_min_minor:min,p_budget_max_minor:max,p_currency:currency,p_needed_by:b.needed_by||null,p_region:b.region||{},p_constraints:b.constraints||{},p_source_ref:safeText(b.source_ref,500)});
    return send(res,result?.duplicate?200:201,result);
  }
  if(req.method==='POST'&&requestPath==='/api/marketplace/v1/agent-intents') {
    if(!rateAllowed(req)) return send(res,429,{error:'Rate limit reached; retry after one minute.'});
    const agent=agentIdentity(req);
    if(!agent||!agent.agent_uri||!agent.principal_party_id) return send(res,401,{error:'Valid registered A2A agent credential required'});
    const b=await readBody(req), action=safeText(b.action,100), amount=Number(b.amount_minor||0), currency=safeText(b.currency||'NZD',3).toUpperCase();
    if(!action||!b.request||typeof b.request!=='object'||!Number.isSafeInteger(amount)||amount<0||!/^[A-Z]{3}$/.test(currency)) return send(res,400,{error:'action, object request, non-negative integer amount_minor, and ISO currency required'});
    const key=safeText(req.headers['idempotency-key']||b.idempotency_key,160)||crypto.randomUUID();
    if(STORE==='local') {
      const id=crypto.randomUUID();
      const e=appendLocal({event_id:crypto.randomUUID(),idempotency_key:key,event_type:'A2A_INTENT_RECORDED',subject_type:'agent_intent',subject_id:id,actor_type:'agent',actor_id:agent.agent_uri,economic_state:'OBSERVED',payload:{action,request:b.request,amount_minor:amount,currency,principal_party_id:agent.principal_party_id,execution_authorized:false,requires_human_approval:true}});
      return send(res,202,{intent_id:id,state:'PENDING_HUMAN_APPROVAL',execution_authorized:false,event_hash:e.event_hash});
    }
    const result=await rpc('marketplace_record_agent_intent',{p_idempotency_key:key,p_agent_uri:agent.agent_uri,p_principal_party_id:agent.principal_party_id,p_action:action,p_request:b.request,p_spend_minor:amount,p_currency:currency});
    return send(res,202,result);
  }
  if(req.method==='POST'&&requestPath==='/api/marketplace/v1/listings') {
    const supplier=supplierIdentity(req); if(!supplier) return send(res,401,{error:'Registered supplier credential required'});
    const b=await readBody(req), key=safeText(req.headers['idempotency-key']||b.idempotency_key,160)||crypto.randomUUID();
    const payload={title:safeText(b.title,180),description:safeText(b.description,12000),category:safeText(b.category,80).toLowerCase(),listing_type:safeText(b.listing_type||'goods',40),pricing_model:safeText(b.pricing_model||'fixed',40),price_minor:b.price_minor==null?null:Number(b.price_minor),currency:safeText(b.currency||'NZD',3).toUpperCase(),quantity:b.quantity==null?null:Number(b.quantity),unit:safeText(b.unit,40),location:b.location||{},attributes:b.attributes||{},seller_party_id:supplier.party_id};
    if(STORE==='local') {
      const old=readLocal(10000).find(e=>e.idempotency_key===key);
      if(old) return send(res,200,{listing_id:old.subject_id,state:'pending_review',duplicate:true});
      if(payload.title.length<4||payload.description.length<10||payload.category.length<2) return send(res,400,{error:'Invalid listing fields'});
      const id=crypto.randomUUID(); appendLocal({event_id:crypto.randomUUID(),idempotency_key:key,event_type:'LISTING_SUBMITTED',subject_type:'listing',subject_id:id,actor_type:'business',actor_id:supplier.party_id,economic_state:'OBSERVED',payload:{...payload,id,status:'pending_review',created_at:new Date().toISOString()}});
      return send(res,201,{listing_id:id,state:'pending_review',message:'Listing submitted for review; not yet public.'});
    }
    const result=await rpc('marketplace_submit_listing',{p_idempotency_key:key,p_seller_party_id:supplier.party_id,p_payload:payload});
    return send(res,result?.duplicate?200:201,result);
  }
  if(req.method==='POST'&&requestPath==='/api/marketplace/v1/evidence') {
    const supplier=supplierIdentity(req); if(!supplier) return send(res,401,{error:'Registered supplier credential required'});
    const b=await readBody(req);
    const evidenceType=safeText(b.evidence_type,80), sourceUri=safeText(b.source_uri,1000), contentHash=safeText(b.content_hash,128);
    if(!evidenceType||!contentHash) return send(res,400,{error:'evidence_type and content_hash are required'});
    if(!/^[a-f0-9]{64}$/i.test(contentHash)) return send(res,400,{error:'content_hash must be a SHA-256 hex digest'});
    const subjectType=safeText(b.subject_type||'order',80), subjectId=uuid(b.subject_id)?b.subject_id:null;
    const evidence={subject_type:subjectType,subject_id:subjectId,evidence_type:evidenceType,source_uri:sourceUri||null,source_hash:safeText(b.source_hash,128)||null,content_hash:contentHash.toLowerCase(),provenance:{submitted_by_party_id:supplier.party_id,submitted_at:new Date().toISOString(),source_description:safeText(b.source_description,1000)},verdict:'UNVERIFIED',verifier:null};
    if(STORE==='local') {
      const id=crypto.randomUUID(), key=safeText(req.headers['idempotency-key'],160)||('evidence:'+contentHash.toLowerCase());
      const old=readLocal(10000).find(e=>e.idempotency_key===key);
      if(old) return send(res,200,{evidence_id:old.subject_id,verdict:'UNVERIFIED',duplicate:true});
      appendLocal({event_id:crypto.randomUUID(),idempotency_key:key,event_type:'EVIDENCE_REGISTERED',subject_type:'evidence',subject_id:id,actor_type:'business',actor_id:supplier.party_id,economic_state:'UNVERIFIED',payload:{...evidence,id,created_at:new Date().toISOString()}});
      return send(res,201,{evidence_id:id,verdict:'UNVERIFIED',message:'Evidence registered locally; it has not been independently verified.'});
    }
    const rows=await rest('marketplace_evidence',{method:'POST',body:JSON.stringify(evidence)});
    const item=Array.isArray(rows)?rows[0]:null;
    if(!item) return send(res,502,{error:'Evidence was not persisted'});
    return send(res,201,{evidence_id:item.id,verdict:'UNVERIFIED',message:'Evidence registered. It has not been independently verified.'});
  }
  const publishMatch=requestPath.match(/^\/api\/marketplace\/v1\/admin\/listings\/([0-9a-f-]{36})\/publish$/i);
  if(req.method==='POST'&&publishMatch) {
    const admin=String(process.env.MARKETPLACE_ADMIN_TOKEN||'');
    if(!admin||String(req.headers.authorization||'')!=='Bearer '+admin) return send(res,401,{error:'Marketplace admin authorization required'});
    if(!uuid(publishMatch[1])) return send(res,400,{error:'Invalid listing id'});
    const b=await readBody(req);
    if(b.evidence_reviewed!==true||b.supplier_authority_confirmed!==true||b.claims_reviewed!==true||safeText(b.reviewed_by,160).length<3) return send(res,400,{error:'Publication gate requires evidence review, supplier authority confirmation, claims review and reviewer identity'});
    const gate={review_required:false,evidence_reviewed:true,supplier_authority_confirmed:true,claims_reviewed:true,reviewed_by:safeText(b.reviewed_by,160),reviewed_at:new Date().toISOString(),evidence_ids:Array.isArray(b.evidence_ids)?b.evidence_ids.filter(uuid):[]};
    if(STORE==='local') {
      const old=readLocal(10000).find(e=>e.idempotency_key==='listing-published:'+publishMatch[1]);
      if(old) return send(res,200,{listing_id:publishMatch[1],state:'published',duplicate:true});
      const submitted=readLocal(10000).find(e=>e.event_type==='LISTING_SUBMITTED'&&e.subject_id===publishMatch[1]);
      if(!submitted) return send(res,404,{error:'Pending local listing not found'});
      appendLocal({event_id:crypto.randomUUID(),idempotency_key:'listing-published:'+publishMatch[1],event_type:'LISTING_PUBLISHED',subject_type:'listing',subject_id:publishMatch[1],actor_type:'human',actor_id:gate.reviewed_by,economic_state:'OBSERVED',payload:{...submitted.payload,status:'published',publication_gate:gate}});
      return send(res,200,{listing_id:publishMatch[1],state:'published',message:'Listing published after explicit review; not evidence of buyer demand or revenue.'});
    }
    const rows=await rest('marketplace_listings?id=eq.'+encodeURIComponent(publishMatch[1])+'&status=eq.pending_review',{method:'PATCH',body:JSON.stringify({status:'published',publication_gate:gate,updated_at:new Date().toISOString()})});
    if(!Array.isArray(rows)||!rows.length) return send(res,409,{error:'Listing is not pending review or could not be published'});
    await rpc('marketplace_append_ledger_event',{p_idempotency_key:'listing-published:'+publishMatch[1],p_event_type:'LISTING_PUBLISHED',p_subject_type:'listing',p_subject_id:publishMatch[1],p_actor_type:'human',p_actor_id:safeText(b.reviewed_by,160),p_economic_state:'OBSERVED',p_payload:{publication_gate:rows[0].publication_gate}});
    return send(res,200,{listing_id:publishMatch[1],state:'published',message:'Listing published after explicit review; not evidence of buyer demand or revenue.'});
  }
  const offerMatch=requestPath.match(/^\/api\/marketplace\/v1\/rfqs\/([0-9a-f-]{36})\/offers$/i);
  if(req.method==='POST'&&offerMatch) {
    const supplier=supplierIdentity(req); if(!supplier) return send(res,401,{error:'Registered supplier credential required'});
    if(!uuid(offerMatch[1])) return send(res,400,{error:'Invalid RFQ id'});
    const b=await readBody(req), key=safeText(req.headers['idempotency-key']||b.idempotency_key,160)||crypto.randomUUID();
    const amount=Number(b.amount_minor);
    if(!Number.isSafeInteger(amount)||amount<0) return send(res,400,{error:'amount_minor must be a non-negative integer'});
    const payload={rfq_id:offerMatch[1],title:safeText(b.title,180),scope:b.scope||{},amount_minor:amount,currency:safeText(b.currency||'NZD',3).toUpperCase(),delivery_terms:b.delivery_terms||{},validity_until:b.validity_until||null,seller_party_id:supplier.party_id};
    if(STORE==='local') {
      const old=readLocal(10000).find(e=>e.idempotency_key===key);
      if(old) return send(res,200,{offer_id:old.subject_id,state:'submitted',duplicate:true});
      const rfq=readLocal(10000).find(e=>e.event_type==='RFQ_SUBMITTED'&&e.subject_id===offerMatch[1]);
      if(!rfq) return send(res,404,{error:'RFQ not found in local ledger'});
      const id=crypto.randomUUID(); appendLocal({event_id:crypto.randomUUID(),idempotency_key:key,event_type:'SUPPLIER_OFFER_SUBMITTED',subject_type:'offer',subject_id:id,actor_type:'business',actor_id:supplier.party_id,economic_state:'OBSERVED',payload:{...payload,id,status:'submitted',created_at:new Date().toISOString()}});
      return send(res,201,{offer_id:id,state:'submitted',message:'Offer recorded; buyer has not accepted it.'});
    }
    const result=await rpc('marketplace_submit_offer',{p_idempotency_key:key,p_seller_party_id:supplier.party_id,p_rfq_id:offerMatch[1],p_payload:payload});
    return send(res,result?.duplicate?200:201,result);
  }
  const acceptMatch=requestPath.match(/^\/api\/marketplace\/v1\/offers\/([0-9a-f-]{36})\/accept$/i);
  if(req.method==='POST'&&acceptMatch) {
    const buyer=buyerIdentity(req); if(!buyer) return send(res,401,{error:'Registered buyer credential required'});
    if(!uuid(acceptMatch[1])) return send(res,400,{error:'Invalid offer id'});
    const b=await readBody(req); if(b.confirmed!==true||safeText(b.authorized_by,160).length<3) return send(res,400,{error:'Explicit human confirmation and authorized_by are required'});
    const key=safeText(req.headers['idempotency-key']||b.idempotency_key,160)||crypto.randomUUID();
    if(STORE==='local') {
      const old=readLocal(10000).find(e=>e.idempotency_key===key);
      if(old) return send(res,200,{order_id:old.subject_id,state:'CREATED',payment_state:'UNPAID',duplicate:true});
      const offer=readLocal(10000).find(e=>e.event_type==='SUPPLIER_OFFER_SUBMITTED'&&e.subject_id===acceptMatch[1]);
      if(!offer) return send(res,404,{error:'Offer not found in local ledger'});
      const orderId=crypto.randomUUID();
      appendLocal({event_id:crypto.randomUUID(),idempotency_key:key,event_type:'ORDER_AUTHORIZED',subject_type:'order',subject_id:orderId,actor_type:'human',actor_id:buyer.party_id,economic_state:'AUTHORIZED',payload:{offer_id:acceptMatch[1],buyer_party_id:buyer.party_id,seller_party_id:offer.actor_id,amount_minor:offer.payload.amount_minor,currency:offer.payload.currency,payment_state:'UNPAID',fulfillment_state:'NOT_STARTED',authorized_by:safeText(b.authorized_by,160),state:'CREATED'}});
      return send(res,201,{order_id:orderId,state:'CREATED',payment_state:'UNPAID',message:'Order authorized; no payment has been taken.'});
    }
    const result=await rpc('marketplace_accept_offer',{p_idempotency_key:key,p_buyer_party_id:buyer.party_id,p_offer_id:acceptMatch[1],p_authorization:{confirmed:true,authorized_by:safeText(b.authorized_by,160),source:'marketplace_api'}});
    return send(res,result?.duplicate?200:201,result);
  }
  const checkoutMatch=requestPath.match(/^\/api\/marketplace\/v1\/orders\/([0-9a-f-]{36})\/checkout$/i);
  if(req.method==='POST'&&checkoutMatch) {
    const buyer=buyerIdentity(req); if(!buyer) return send(res,401,{error:'Registered buyer credential required'});
    // Fail closed until seller payout/Connect, refund, tax and reconciliation are verified.
    if(process.env.MARKETPLACE_ENABLE_CHECKOUT!=='true'||process.env.MARKETPLACE_PAYOUT_MODEL!=='stripe_connect_verified') return send(res,503,{error:'CHECKOUT_HELD: seller payout/Connect, refunds and reconciliation gates are not verified. No charge was created.'});
    return send(res,503,{error:'CHECKOUT_HELD: the verified seller settlement adapter is not yet implemented. No charge was created.'});
  }
  const deliveryMatch=requestPath.match(/^\/api\/marketplace\/v1\/orders\/([0-9a-f-]{36})\/delivery$/i);
  if(req.method==='POST'&&deliveryMatch) {
    const supplier=supplierIdentity(req); if(!supplier) return send(res,401,{error:'Registered supplier credential required'});
    if(!uuid(deliveryMatch[1])) return send(res,400,{error:'Invalid order id'});
    const b=await readBody(req), ids=Array.isArray(b.evidence_ids)?b.evidence_ids.filter(uuid):[];
    if(!ids.length) return send(res,400,{error:'At least one registered evidence UUID is required'});
    const order=await rest('marketplace_orders?select=id,seller_party_id&id=eq.'+encodeURIComponent(deliveryMatch[1]));
    if(!Array.isArray(order)||!order.length||order[0].seller_party_id!==supplier.party_id) return send(res,403,{error:'Order not found for this supplier'});
    const key=safeText(req.headers['idempotency-key']||b.idempotency_key,160)||crypto.randomUUID();
    const result=await rpc('marketplace_record_delivery',{p_order_id:deliveryMatch[1],p_idempotency_key:key,p_manifest:{fulfillment_type:safeText(b.fulfillment_type||'digital_or_service',80),deliverable_manifest:b.deliverable_manifest||{},delivery_reference:safeText(b.delivery_reference,500)},p_evidence_ids:ids});
    return send(res,200,result);
  }
  const acceptDeliveryMatch=requestPath.match(/^\/api\/marketplace\/v1\/orders\/([0-9a-f-]{36})\/acceptance$/i);
  if(req.method==='POST'&&acceptDeliveryMatch) {
    const buyer=buyerIdentity(req); if(!buyer) return send(res,401,{error:'Registered buyer credential required'});
    if(!uuid(acceptDeliveryMatch[1])) return send(res,400,{error:'Invalid order id'});
    const b=await readBody(req); if(typeof b.accept!=='boolean') return send(res,400,{error:'accept boolean required'});
    const key=safeText(req.headers['idempotency-key']||b.idempotency_key,160)||crypto.randomUUID();
    const result=await rpc('marketplace_accept_delivery',{p_order_id:acceptDeliveryMatch[1],p_buyer_party_id:buyer.party_id,p_idempotency_key:key,p_accept:b.accept,p_reason:safeText(b.reason,2000)});
    return send(res,200,result);
  }
  if(req.method==='GET'&&requestPath==='/api/marketplace/v1/ledger') {
    const u=new URL(req.url,'http://localhost'), limit=Math.min(Math.max(Number(u.searchParams.get('limit')||50),1),100);
    if(String(req.headers.authorization||'')!==('Bearer '+String(process.env.MARKETPLACE_AUDIT_TOKEN||'__disabled__'))) return send(res,401,{error:'Audit authorization required'});
    if(STORE==='local') return send(res,200,{schema:'DREAMLEDGER/MARKETPLACE-LEDGER/v1',events:readLocal(limit)});
    const rows=await rpc('marketplace_audit_ledger',{p_limit:limit});
    return send(res,200,{schema:'DREAMLEDGER/MARKETPLACE-LEDGER/v1',events:rows||[]});
  }
  return send(res,404,{error:'Marketplace endpoint not found'});
}
module.exports={handle};
