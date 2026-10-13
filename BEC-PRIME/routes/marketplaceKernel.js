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
async function stripePost(endpoint,params,idempotencyKey) {
  const secret=String(process.env.STRIPE_SECRET_KEY||'');
  if(!secret) throw Object.assign(new Error('Stripe is not configured'),{statusCode:503});
  const form=new URLSearchParams();
  for(const [key,value] of Object.entries(params)) if(value!==undefined&&value!==null) form.set(key,String(value));
  const abort=new AbortController(); const timer=setTimeout(()=>abort.abort(),10000);
  try {
    const response=await fetch('https://api.stripe.com/v1/'+endpoint,{method:'POST',headers:{Authorization:'Bearer '+secret,'Content-Type':'application/x-www-form-urlencoded','Idempotency-Key':idempotencyKey},body:form,signal:abort.signal});
    const raw=await response.text(); let data; try{data=raw?JSON.parse(raw):{};}catch{data={message:raw.slice(0,500)};}
    if(!response.ok) throw Object.assign(new Error(data?.error?.message||'Stripe request failed'),{statusCode:502});
    return data;
  } catch(err) { if(err.name==='AbortError') throw Object.assign(new Error('Stripe request timed out; retry with the same order id'),{statusCode:503}); throw err; }
  finally { clearTimeout(timer); }
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
function localKey() {
  const raw=String(process.env.MARKETPLACE_LOCAL_ENCRYPTION_KEY||'').trim();
  if(!/^[a-f0-9]{64}$/i.test(raw)) throw Object.assign(new Error('MARKETPLACE_LOCAL_ENCRYPTION_KEY must be a 32-byte hex key'),{statusCode:503});
  return Buffer.from(raw,'hex');
}
function envelopeHash(envelope) {
  const core={v:envelope.v,previous_hash:envelope.previous_hash,iv:envelope.iv,tag:envelope.tag,ciphertext:envelope.ciphertext};
  return crypto.createHash('sha256').update(JSON.stringify(core)).digest('hex');
}
function decodeLocalLine(line, expectedPrevious) {
  const envelope=JSON.parse(line);
  if(envelope.v!==1||envelope.previous_hash!==(expectedPrevious||null)||envelope.event_hash!==envelopeHash(envelope)) throw new Error('Local marketplace ledger hash chain is invalid');
  const decipher=crypto.createDecipheriv('aes-256-gcm',localKey(),Buffer.from(envelope.iv,'base64'));
  decipher.setAuthTag(Buffer.from(envelope.tag,'base64'));
  const plain=Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext,'base64')),decipher.final()]).toString('utf8');
  const event=JSON.parse(plain);
  if(event.previous_hash!==(expectedPrevious||null)) throw new Error('Local marketplace event chain mismatch');
  event.event_hash=envelope.event_hash;
  return event;
}
function appendLocal(event) {
  const key=localKey();
  fs.mkdirSync(path.dirname(LEDGER_PATH),{recursive:true});
  let previous=null;
  try {
    const lines=fs.readFileSync(LEDGER_PATH,'utf8').split('\n').filter(Boolean);
    if(lines.length) {
      let chain=null;
      for(const line of lines) { const decoded=decodeLocalLine(line,chain); chain=JSON.parse(line).event_hash; }
      previous=chain;
    }
  } catch(err) { if(err.code!=='ENOENT') throw err; }
  const canonical={...event,previous_hash:previous,recorded_at:new Date().toISOString()};
  const iv=crypto.randomBytes(12);
  const cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
  const plaintext=Buffer.from(JSON.stringify(canonical),'utf8');
  const ciphertext=Buffer.concat([cipher.update(plaintext),cipher.final()]);
  const envelope={v:1,previous_hash:previous,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ciphertext:ciphertext.toString('base64')};
  envelope.event_hash=envelopeHash(envelope);
  const fd=fs.openSync(LEDGER_PATH,'a',0o600);
  try { fs.writeSync(fd,JSON.stringify(envelope)+'\n'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  return {...canonical,event_hash:envelope.event_hash};
}
function readLocal(limit=100) {
  try {
    const lines=fs.readFileSync(LEDGER_PATH,'utf8').split('\n').filter(Boolean);
    let previous=null; const decoded=[];
    for(const line of lines) { decoded.push(decodeLocalLine(line,previous)); previous=JSON.parse(line).event_hash; }
    return decoded.slice(-limit).reverse();
  } catch(err) { if(err.code==='ENOENT') return []; throw err; }
}
function localStatus() {
  const dir=path.dirname(LEDGER_PATH);
  let writable=false, keyConfigured=/^[a-f0-9]{64}$/i.test(String(process.env.MARKETPLACE_LOCAL_ENCRYPTION_KEY||''));
  try { fs.mkdirSync(dir,{recursive:true}); fs.accessSync(dir,fs.constants.W_OK); writable=true; } catch {}
  const available=writable&&keyConfigured;
  return {mode:'local',status:available?'available':'unavailable',durability:'AES-256-GCM encrypted, hash-chained JSONL; single-writer only; requires persistent disk and configured encryption key; not safe for multi-replica deployment',ledger_path_configured:Boolean(process.env.MARKETPLACE_LEDGER_PATH),encryption_key_configured:keyConfigured,writable};
}
function publicListing(row) {
  return {id:row.id,title:row.title,description:row.description,category:row.category,listing_type:row.listing_type,price_minor:row.price_minor,currency:row.currency,pricing_model:row.pricing_model,quantity:row.quantity,unit:row.unit,location:row.location||{},attributes:row.attributes||{},created_at:row.created_at};
}
async function agentIdentity(req) {
  const x=await credentialMap('A2A_AGENT_KEYS_JSON',req,'agent');
  return x&&x.agent_uri&&x.principal_party_id?x:null;
}
async function status(req,res) {
  if(STORE==='local') return send(res,200,{schema:'DREAMLEDGER/MARKETPLACE-STATUS/v1',...localStatus(),economic_truth:'No revenue is inferred from ledger rows; settlement, fulfillment, delivery and independent evidence must reconcile.'});
  const configured=Boolean(BASE&&SERVICE_KEY);
  let backend='unreachable';
  if(configured) { try { await rpc('marketplace_public_listings',{p_query:'__healthcheck_no_match__',p_category:null,p_listing_type:null,p_limit:1,p_offset:0}); backend='available'; } catch(err) { return send(res,503,{schema:'DREAMLEDGER/MARKETPLACE-STATUS/v1',mode:'supabase',status:'unavailable',configured,error_code:err.statusCode||503,message:'Supabase RPC preflight failed; no fallback or split-brain write attempted.'}); } }
  return send(res,configured?200:503,{schema:'DREAMLEDGER/MARKETPLACE-STATUS/v1',mode:'supabase',status:backend,configured,economic_truth:'No revenue is inferred from ledger rows; settlement, fulfillment, delivery and independent evidence must reconcile.'});
}
async function credentialMap(envName, req, credentialType) {
  const header=String(req.headers.authorization||'');
  if(!header.startsWith('Bearer ')) return null;
  const token=header.slice(7), hash=crypto.createHash('sha256').update(token).digest('hex');
  let configured={}; try { configured=JSON.parse(process.env[envName]||'{}'); } catch {}
  if(configured[hash]) return configured[hash];
  if(STORE!=='supabase'||!BASE||!SERVICE_KEY) return null;
  try {
    const rows=await rest('marketplace_api_credentials?select=id,credential_type,party_id,scopes,agent_uri,principal_party_id,expires_at&token_hash=eq.'+hash+'&credential_type=eq.'+encodeURIComponent(credentialType)+'&status=eq.active');
    const item=Array.isArray(rows)?rows[0]:null;
    if(!item||(item.expires_at&&Date.parse(item.expires_at)<=Date.now())) return null;
    return {...item,credential_id:item.id};
  } catch { return null; }
}
function hasScope(identity,scope){return !Array.isArray(identity?.scopes)||identity.scopes.includes(scope);}
async function supplierIdentity(req){const x=await credentialMap('MARKETPLACE_SUPPLIER_KEYS_JSON',req,'supplier');return x&&x.party_id?x:null;}
async function buyerIdentity(req){const x=await credentialMap('MARKETPLACE_BUYER_KEYS_JSON',req,'buyer');return x&&x.party_id?x:null;}
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
  if(req.method==='GET'&&requestPath==='/api/marketplace/v1/auctions') {
    if(STORE==='local') return send(res,200,{schema:'DREAMLEDGER/MARKETPLACE-AUCTIONS/v1',auctions:[],message:'Timed auctions require the transactional Supabase backend; local mode does not accept bids.'});
    const u=new URL(req.url,'http://localhost'), limit=Math.min(Math.max(Number(u.searchParams.get('limit')||30),1),100);
    const rows=await rpc('marketplace_public_auctions',{p_limit:limit});
    return send(res,200,{schema:'DREAMLEDGER/MARKETPLACE-AUCTIONS/v1',auctions:Array.isArray(rows)?rows:[]});
  }
  const scheduleAuctionMatch=requestPath.match(/^\/api\/marketplace\/v1\/listings\/([0-9a-f-]{36})\/auction$/i);
  if(req.method==='POST'&&scheduleAuctionMatch) {
    const supplier=await supplierIdentity(req); if(!supplier) return send(res,401,{error:'Registered supplier credential required'});
    if(!hasScope(supplier,'schedule_auction')) return send(res,403,{error:'Supplier credential lacks schedule_auction scope'});
    if(STORE!=='supabase') return send(res,503,{error:'Timed auction scheduling requires the transactional Supabase backend.'});
    if(!uuid(scheduleAuctionMatch[1])) return send(res,400,{error:'Invalid listing id'});
    const b=await readBody(req), key=safeText(req.headers['idempotency-key']||b.idempotency_key,160)||crypto.randomUUID();
    const result=await rpc('marketplace_schedule_auction',{p_idempotency_key:key,p_seller_party_id:supplier.party_id,p_listing_id:scheduleAuctionMatch[1],p_payload:{starts_at:b.starts_at,ends_at:b.ends_at,starting_price_minor:b.starting_price_minor,reserve_price_minor:b.reserve_price_minor,buy_now_price_minor:b.buy_now_price_minor,minimum_increment_minor:b.minimum_increment_minor,currency:safeText(b.currency||'NZD',3).toUpperCase(),anti_sniping_seconds:b.anti_sniping_seconds}});
    return send(res,result?.duplicate?200:201,result);
  }
  const bidMatch=requestPath.match(/^\/api\/marketplace\/v1\/auctions\/([0-9a-f-]{36})\/bids$/i);
  if(req.method==='POST'&&bidMatch) {
    const buyer=await buyerIdentity(req); if(!buyer) return send(res,401,{error:'Registered buyer credential required'});
    if(!hasScope(buyer,'place_bid')) return send(res,403,{error:'Buyer credential lacks place_bid scope'});
    if(STORE!=='supabase') return send(res,503,{error:'Timed auction bidding requires the transactional Supabase backend.'});
    if(!uuid(bidMatch[1])) return send(res,400,{error:'Invalid auction id'});
    const b=await readBody(req), amount=Number(b.amount_minor);
    if(!Number.isSafeInteger(amount)||amount<0||b.confirmed!==true||safeText(b.authorized_by,160).length<3) return send(res,400,{error:'amount_minor and explicit human bid confirmation are required'});
    const key=safeText(req.headers['idempotency-key']||b.idempotency_key,160)||crypto.randomUUID();
    const result=await rpc('marketplace_place_bid',{p_idempotency_key:key,p_auction_id:bidMatch[1],p_bidder_party_id:buyer.party_id,p_amount_minor:amount,p_currency:safeText(b.currency||'NZD',3).toUpperCase(),p_authorization:{confirmed:true,authorized_by:safeText(b.authorized_by,160)}});
    return send(res,result?.duplicate?200:201,result);
  }
  const buyNowMatch=requestPath.match(/^\/api\/marketplace\/v1\/auctions\/([0-9a-f-]{36})\/buy-now$/i);
  if(req.method==='POST'&&buyNowMatch) {
    const buyer=await buyerIdentity(req); if(!buyer) return send(res,401,{error:'Registered buyer credential required'});
    if(!hasScope(buyer,'buy_now')) return send(res,403,{error:'Buyer credential lacks buy_now scope'});
    if(STORE!=='supabase') return send(res,503,{error:'Auction buy-now requires the transactional Supabase backend.'});
    if(!uuid(buyNowMatch[1])) return send(res,400,{error:'Invalid auction id'});
    const b=await readBody(req);
    if(b.confirmed!==true||safeText(b.authorized_by,160).length<3) return send(res,400,{error:'Explicit human buy-now confirmation is required'});
    const key=safeText(req.headers['idempotency-key']||b.idempotency_key,160)||crypto.randomUUID();
    const result=await rpc('marketplace_buy_now',{p_idempotency_key:key,p_auction_id:buyNowMatch[1],p_buyer_party_id:buyer.party_id,p_authorization:{confirmed:true,authorized_by:safeText(b.authorized_by,160)}});
    return send(res,result?.duplicate?200:201,result);
  }
  const closeAuctionMatch=requestPath.match(/^\/api\/marketplace\/v1\/admin\/auctions\/([0-9a-f-]{36})\/close$/i);
  if(req.method==='POST'&&closeAuctionMatch) {
    const admin=String(process.env.MARKETPLACE_ADMIN_TOKEN||'');
    if(!admin||String(req.headers.authorization||'')!=='Bearer '+admin) return send(res,401,{error:'Marketplace admin authorization required'});
    if(STORE!=='supabase') return send(res,503,{error:'Auction closeout requires the transactional Supabase backend.'});
    if(!uuid(closeAuctionMatch[1])) return send(res,400,{error:'Invalid auction id'});
    const b=await readBody(req);
    const result=await rpc('marketplace_close_auction',{p_auction_id:closeAuctionMatch[1],p_closed_by:safeText(b.closed_by||'marketplace_admin',160)});
    return send(res,200,result);
  }
  if(req.method==='GET'&&requestPath==='/api/marketplace/v1/listings') {
    const u=new URL(req.url,'http://localhost'), q=safeText(u.searchParams.get('q'),160), category=safeText(u.searchParams.get('category'),80)||null, type=safeText(u.searchParams.get('type'),40)||null;
    if(STORE==='local') return send(res,200,{schema:'DREAMLEDGER/MARKETPLACE-LISTINGS/v1',listings:readLocal(500).filter(e=>e.event_type==='LISTING_PUBLISHED'&&e.payload?.status==='published').map(e=>e.payload).filter(x=>(!q||JSON.stringify(x).toLowerCase().includes(q.toLowerCase()))&&(!category||x.category===category)&&(!type||x.listing_type===type)).slice(0,50).map(publicListing)});
    const rows=await rpc('marketplace_public_listings',{p_query:q,p_category:category,p_listing_type:type,p_limit:Math.min(Math.max(Number(u.searchParams.get('limit')||24),1),100),p_offset:Math.max(Number(u.searchParams.get('offset')||0),0)});
    return send(res,200,{schema:'DREAMLEDGER/MARKETPLACE-LISTINGS/v1',listings:Array.isArray(rows)?rows:[]});
  }
  if(req.method==='POST'&&requestPath==='/api/marketplace/v1/party-applications') {
    if(!rateAllowed(req)) return send(res,429,{error:'Rate limit reached; retry after one minute.'});
    const b=await readBody(req);
    if(safeText(b.website_honeypot,200)) return send(res,202,{state:'REJECTED_SPAM'});
    const partyType=safeText(b.party_type,20), displayName=safeText(b.display_name,160), email=safeText(b.contact_email,254).toLowerCase(), country=safeText(b.country_code,2).toUpperCase();
    if(!['business','human'].includes(partyType)||displayName.length<2||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!/^[A-Z]{2}$/.test(country)) return send(res,400,{error:'party_type, display_name, valid contact_email and ISO country_code are required'});
    const key=safeText(req.headers['idempotency-key']||b.idempotency_key,160)||crypto.randomUUID();
    const profile={website:safeText(b.business_website,500),requested_role:partyType==='business'?'buyer_and_supplier':'buyer'};
    if(STORE==='local') {
      const old=readLocal(10000).find(e=>e.idempotency_key===key);
      if(old) return send(res,200,{application_id:old.subject_id,status:'pending',duplicate:true});
      const id=crypto.randomUUID();
      appendLocal({event_id:crypto.randomUUID(),idempotency_key:key,event_type:'PARTY_APPLICATION_SUBMITTED',subject_type:'marketplace_party',subject_id:id,actor_type:'human',actor_id:null,economic_state:'OBSERVED',payload:{id,party_type:partyType,display_name:displayName,contact_email:email,country_code:country,public_profile:profile,application_notes:safeText(b.application_notes,2000),status:'pending',trust_state:'UNVERIFIED'}});
      return send(res,202,{application_id:id,status:'pending',trust_state:'UNVERIFIED',message:'Application encrypted in the local journal; no account credentials or transaction authority were issued.'});
    }
    const result=await rpc('marketplace_apply_party',{p_idempotency_key:key,p_party_type:partyType,p_display_name:displayName,p_country_code:country,p_contact_email:email,p_public_profile:profile,p_application_notes:safeText(b.application_notes,2000)});
    return send(res,result?.duplicate?200:202,{application_id:result.party_id,status:result.status,trust_state:result.trust_state,duplicate:result.duplicate,message:result.message});
  }
  const approvePartyMatch=requestPath.match(/^\/api\/marketplace\/v1\/admin\/parties\/([0-9a-f-]{36})\/approve$/i);
  if(req.method==='POST'&&approvePartyMatch) {
    const admin=String(process.env.MARKETPLACE_ADMIN_TOKEN||'');
    if(!admin||String(req.headers.authorization||'')!=='Bearer '+admin) return send(res,401,{error:'Marketplace admin authorization required'});
    if(STORE!=='supabase') return send(res,503,{error:'Party approval requires Supabase mode; local applications remain pending.'});
    if(!uuid(approvePartyMatch[1])) return send(res,400,{error:'Invalid party id'});
    const b=await readBody(req);
    if(b.email_verified!==true||b.authority_confirmed!==true||safeText(b.reviewed_by,160).length<3) return send(res,400,{error:'email_verified, authority_confirmed and reviewed_by are required'});
    const key=safeText(req.headers['idempotency-key']||b.idempotency_key,160)||('party-approved:'+approvePartyMatch[1]);
    const result=await rpc('marketplace_approve_party',{p_idempotency_key:key,p_party_id:approvePartyMatch[1],p_reviewed_by:safeText(b.reviewed_by,160),p_email_verified:true,p_authority_confirmed:true});
    return send(res,200,result);
  }
  if(req.method==='POST'&&requestPath==='/api/marketplace/v1/rfqs') {
    if(!rateAllowed(req)) return send(res,429,{error:'Rate limit reached; retry after one minute.'});
    const b=await readBody(req);
    const hasAuthorization=String(req.headers.authorization||'').startsWith('Bearer ');
    const buyer=hasAuthorization?await buyerIdentity(req):null;
    if(hasAuthorization&&!buyer) return send(res,401,{error:'Invalid registered buyer credential'});
    if(buyer&&!hasScope(buyer,'submit_rfq')) return send(res,403,{error:'Buyer credential lacks submit_rfq scope'});
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
      const event=appendLocal({event_id:crypto.randomUUID(),idempotency_key:key,event_type:'RFQ_SUBMITTED',subject_type:'rfq',subject_id:rfqId,actor_type:'human',actor_id:null,economic_state:'OBSERVED',payload:{id:rfqId,title,problem_statement:problem,category,budget_min_minor:min,budget_max_minor:max,currency,region:b.region||{},constraints:b.constraints||{},buyer_party_id:buyer?.party_id||null,status:'open',authorization_state:buyer?'AUTHORIZED':'UNAUTHORIZED'}});
      return send(res,201,{rfq_id:rfqId,state:'OBSERVED',event_hash:event.event_hash,message:'RFQ recorded; it has not been matched to suppliers and no response is guaranteed.'});
    }
    const result=await rpc('marketplace_create_public_rfq',{p_idempotency_key:key,p_title:title,p_problem:problem,p_category:category,p_budget_min_minor:min,p_budget_max_minor:max,p_currency:currency,p_needed_by:b.needed_by||null,p_region:b.region||{},p_constraints:b.constraints||{},p_source_ref:safeText(b.source_ref,500),p_buyer_party_id:buyer?.party_id||null});
    return send(res,result?.duplicate?200:201,result);
  }
  if(req.method==='POST'&&requestPath==='/api/marketplace/v1/agent-intents') {
    if(!rateAllowed(req)) return send(res,429,{error:'Rate limit reached; retry after one minute.'});
    const agent=await agentIdentity(req);
    if(!agent||!agent.agent_uri||!agent.principal_party_id) return send(res,401,{error:'Valid registered A2A agent credential required'});
    if(!hasScope(agent,'agent_intent')) return send(res,403,{error:'Agent credential lacks agent_intent scope'});
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
    const supplier=await supplierIdentity(req); if(!supplier) return send(res,401,{error:'Registered supplier credential required'});
    if(!hasScope(supplier,'submit_listing')) return send(res,403,{error:'Supplier credential lacks submit_listing scope'});
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
    const supplier=await supplierIdentity(req); if(!supplier) return send(res,401,{error:'Registered supplier credential required'});
    if(!hasScope(supplier,'submit_evidence')) return send(res,403,{error:'Supplier credential lacks submit_evidence scope'});
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
  if(req.method==='GET'&&requestPath==='/api/marketplace/v1/admin/cube-hypotheses') {
    const admin=String(process.env.MARKETPLACE_ADMIN_TOKEN||'');
    if(!admin||String(req.headers.authorization||'')!=='Bearer '+admin) return send(res,401,{error:'Marketplace admin authorization required'});
    let hypotheses=[];
    if(STORE==='local') {
      const file=path.join(ROOT,'..','data','777','cube-b2b-sales-hypotheses.v1.json');
      try { const registry=JSON.parse(fs.readFileSync(file,'utf8')); hypotheses=registry.hypotheses||[]; }
      catch { return send(res,503,{error:'CUBE hypothesis registry is unavailable'}); }
    } else {
      const rows=await rest('marketplace_cube_hypotheses?select=id,buyer_segment,problem_statement,offer_hypothesis,price_hypothesis,candidate_silo,priority,state,source_evidence_ids,kill_reason,created_at,updated_at&order=priority.asc,created_at.asc&limit=200');
      hypotheses=Array.isArray(rows)?rows:[];
    }
    const counts=hypotheses.reduce((acc,h)=>{const k=String(h.state||h.status||'UNKNOWN');acc[k]=(acc[k]||0)+1;return acc;},{});
    return send(res,200,{schema:'DREAMLEDGER/CUBE-SALES-HYPOTHESES/v1',count:hypotheses.length,counts,hypotheses,truth_boundary:'Candidates remain unvalidated until attributable external evidence passes the qualification gate.'});
  }
  if(req.method==='POST'&&requestPath==='/api/marketplace/v1/admin/credentials') {
    const admin=String(process.env.MARKETPLACE_ADMIN_TOKEN||'');
    if(!admin||String(req.headers.authorization||'')!=='Bearer '+admin) return send(res,401,{error:'Marketplace admin authorization required'});
    if(STORE!=='supabase') return send(res,503,{error:'Dynamic credentials require the selected Supabase ledger; configure env-based hashes for local mode.'});
    const b=await readBody(req), role=safeText(b.credential_type,20), partyId=safeText(b.party_id,36), createdBy=safeText(b.created_by,160);
    if(!uuid(partyId)||!['buyer','supplier','agent'].includes(role)||createdBy.length<3) return send(res,400,{error:'party_id, credential_type buyer|supplier|agent, and created_by are required'});
    const scopes=Array.isArray(b.scopes)?[...new Set(b.scopes.map(x=>safeText(x,80)).filter(Boolean))]:[];
    if(!scopes.length) return send(res,400,{error:'At least one explicit credential scope is required'});
    const parties=await rest('marketplace_parties?select=id,status,party_type&id=eq.'+encodeURIComponent(partyId));
    if(!Array.isArray(parties)||!parties[0]||parties[0].status!=='active') return send(res,404,{error:'Active marketplace party not found'});
    let agentUri=null, principalPartyId=null;
    if(role==='agent') {
      agentUri=safeText(b.agent_uri,1000); principalPartyId=safeText(b.principal_party_id,36);
      if(!agentUri||!uuid(principalPartyId)) return send(res,400,{error:'agent_uri and principal_party_id are required for agent credentials'});
      const principals=await rest('marketplace_agent_principals?select=id,party_id,principal_party_id,agent_uri,status&party_id=eq.'+encodeURIComponent(partyId)+'&principal_party_id=eq.'+encodeURIComponent(principalPartyId)+'&agent_uri=eq.'+encodeURIComponent(agentUri)+'&status=eq.active');
      if(!Array.isArray(principals)||!principals.length) return send(res,403,{error:'An active registered agent principal must exist before issuing credentials'});
    }
    const token='dlm_'+crypto.randomBytes(32).toString('hex'), tokenHash=crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt=b.expires_at?new Date(b.expires_at).toISOString():null;
    const rows=await rest('marketplace_api_credentials',{method:'POST',body:JSON.stringify({token_hash:tokenHash,credential_type:role,party_id:partyId,scopes,agent_uri:agentUri,principal_party_id:principalPartyId,expires_at:expiresAt,created_by:createdBy,status:'active'})});
    const credential=Array.isArray(rows)?rows[0]:null;
    if(!credential) return send(res,502,{error:'Credential was not persisted'});
    return send(res,201,{credential_id:credential.id,credential_type:role,party_id:partyId,scopes,expires_at:credential.expires_at,token,warning:'Copy this token now. It is not stored in plaintext and cannot be retrieved later.'});
  }
  const revokeCredentialMatch=requestPath.match(/^\/api\/marketplace\/v1\/admin\/credentials\/([0-9a-f-]{36})\/revoke$/i);
  if(req.method==='POST'&&revokeCredentialMatch) {
    const admin=String(process.env.MARKETPLACE_ADMIN_TOKEN||'');
    if(!admin||String(req.headers.authorization||'')!=='Bearer '+admin) return send(res,401,{error:'Marketplace admin authorization required'});
    if(STORE!=='supabase') return send(res,503,{error:'Dynamic credential revocation requires Supabase mode.'});
    if(!uuid(revokeCredentialMatch[1])) return send(res,400,{error:'Invalid credential id'});
    const rows=await rest('marketplace_api_credentials?id=eq.'+encodeURIComponent(revokeCredentialMatch[1])+'&status=eq.active',{method:'PATCH',body:JSON.stringify({status:'revoked',revoked_at:new Date().toISOString()})});
    return Array.isArray(rows)&&rows.length?send(res,200,{credential_id:revokeCredentialMatch[1],status:'revoked'}):send(res,404,{error:'Active credential not found'});
  }
  const connectMatch=requestPath.match(/^\/api\/marketplace\/v1\/admin\/parties\/([0-9a-f-]{36})\/connect-onboarding$/i);
  if(req.method==='POST'&&connectMatch) {
    const admin=String(process.env.MARKETPLACE_ADMIN_TOKEN||'');
    if(!admin||String(req.headers.authorization||'')!=='Bearer '+admin) return send(res,401,{error:'Marketplace admin authorization required'});
    if(process.env.MARKETPLACE_ENABLE_CONNECT_ONBOARDING!=='true') return send(res,503,{error:'Connect onboarding is disabled until explicitly enabled by an operator.'});
    if(!uuid(connectMatch[1])) return send(res,400,{error:'Invalid marketplace party id'});
    const b=await readBody(req), email=safeText(b.email,254);
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return send(res,400,{error:'Valid seller email is required for Stripe-hosted onboarding'});
    const parties=await rest('marketplace_parties?select=id,display_name,country_code,stripe_account_id,status&id=eq.'+encodeURIComponent(connectMatch[1]));
    const party=Array.isArray(parties)?parties[0]:null;
    if(!party||party.status!=='active') return send(res,404,{error:'Active marketplace party not found'});
    const country=String(party.country_code||b.country_code||'').toUpperCase();
    if(!/^[A-Z]{2}$/.test(country)) return send(res,400,{error:'Seller country_code must be set to a valid ISO alpha-2 code'});
    let accountId=party.stripe_account_id;
    if(!accountId) {
      const account=await stripePost('accounts',{type:'express',country,email,'capabilities[card_payments][requested]':'true','capabilities[transfers][requested]':'true','business_profile[name]':safeText(party.display_name,160),'metadata[marketplace_party_id]':party.id},'marketplace-connect-account:'+party.id);
      if(!account.id) throw Object.assign(new Error('Stripe did not return a connected account id'),{statusCode:502});
      accountId=account.id;
      await rest('marketplace_parties?id=eq.'+encodeURIComponent(party.id),{method:'PATCH',body:JSON.stringify({stripe_account_id:accountId,stripe_charges_enabled:false,stripe_payouts_enabled:false,stripe_details_submitted:false,updated_at:new Date().toISOString()})});
    }
    const base=(process.env.PUBLIC_BASE_URL||'https://dreamledger.org').replace(/\/$/,'');
    const link=await stripePost('account_links',{account:accountId,refresh_url:base+'/marketplace.html?connect=refresh',return_url:base+'/marketplace.html?connect=return',type:'account_onboarding','collection_options[fields]':'eventually_due'},'marketplace-connect-link:'+party.id+':'+Math.floor(Date.now()/60000));
    return send(res,200,{party_id:party.id,connected_account_id:accountId,onboarding_url:link.url,expires_at:link.expires_at,charges_enabled:false,payouts_enabled:false,message:'Seller must complete Stripe-hosted onboarding. Checkout remains unavailable until signed account.updated evidence confirms charges, payouts and details submitted.'});
  }
  const publishMatch=requestPath.match(/^\/api\/marketplace\/v1\/admin\/listings\/([0-9a-f-]{36})\/publish$/i);
  if(req.method==='POST'&&publishMatch) {
    const admin=String(process.env.MARKETPLACE_ADMIN_TOKEN||'');
    if(!admin||String(req.headers.authorization||'')!=='Bearer '+admin) return send(res,401,{error:'Marketplace admin authorization required'});
    if(!uuid(publishMatch[1])) return send(res,400,{error:'Invalid listing id'});
    const b=await readBody(req);
    if(b.evidence_reviewed!==true||b.supplier_authority_confirmed!==true||b.claims_reviewed!==true||safeText(b.reviewed_by,160).length<3) return send(res,400,{error:'Publication gate requires evidence review, supplier authority confirmation, claims review and reviewer identity'});
    const evidenceIds=Array.isArray(b.evidence_ids)?[...new Set(b.evidence_ids.filter(uuid))]:[];
    if(!evidenceIds.length) return send(res,400,{error:'At least one registered evidence UUID tied to this listing is required for publication'});
    const gate={review_required:false,evidence_reviewed:true,supplier_authority_confirmed:true,claims_reviewed:true,reviewed_by:safeText(b.reviewed_by,160),reviewed_at:new Date().toISOString(),evidence_ids:evidenceIds};
    if(STORE==='local') {
      const old=readLocal(10000).find(e=>e.idempotency_key==='listing-published:'+publishMatch[1]);
      if(old) return send(res,200,{listing_id:publishMatch[1],state:'published',duplicate:true});
      const submitted=readLocal(10000).find(e=>e.event_type==='LISTING_SUBMITTED'&&e.subject_id===publishMatch[1]);
      if(!submitted) return send(res,404,{error:'Pending local listing not found'});
      if(submitted.payload?.pricing_model==='auction') return send(res,503,{error:'Timed auctions require the transactional Supabase backend; listing remains unpublished.'});
      const registeredEvidence=readLocal(10000).filter(e=>e.event_type==='EVIDENCE_REGISTERED'&&e.payload?.subject_type==='listing'&&e.payload?.subject_id===publishMatch[1]).map(e=>e.subject_id);
      if(evidenceIds.some(id=>!registeredEvidence.includes(id))) return send(res,400,{error:'Every publication evidence ID must be registered against this listing'});
      appendLocal({event_id:crypto.randomUUID(),idempotency_key:'listing-published:'+publishMatch[1],event_type:'LISTING_PUBLISHED',subject_type:'listing',subject_id:publishMatch[1],actor_type:'human',actor_id:gate.reviewed_by,economic_state:'OBSERVED',payload:{...submitted.payload,status:'published',publication_gate:gate}});
      return send(res,200,{listing_id:publishMatch[1],state:'published',message:'Listing published after explicit review; not evidence of buyer demand or revenue.'});
    }
    const pendingListings=await rest('marketplace_listings?select=id,pricing_model&id=eq.'+encodeURIComponent(publishMatch[1])+'&status=eq.pending_review');
    const pendingListing=Array.isArray(pendingListings)?pendingListings[0]:null;
    if(!pendingListing) return send(res,409,{error:'Listing is not pending review'});
    const evidenceRows=await rest('marketplace_evidence?select=id,subject_type,subject_id,verdict&id=in.('+evidenceIds.join(',')+')&subject_type=eq.listing&subject_id=eq.'+encodeURIComponent(publishMatch[1]));
    if(!Array.isArray(evidenceRows)||evidenceRows.length!==evidenceIds.length) return send(res,400,{error:'Publication evidence must exist and be linked to this listing'});
    const auctions=await rest('marketplace_auctions?select=id,starts_at,ends_at,status&listing_id=eq.'+encodeURIComponent(publishMatch[1])+'&status=eq.pending_review');
    const auction=Array.isArray(auctions)?auctions[0]:null;
    if(pendingListing.pricing_model==='auction'&&!auction) return send(res,409,{error:'Auction listing requires a reviewed auction schedule before publication'});
    if(auction&&Date.parse(auction.ends_at)<=Date.now()) return send(res,409,{error:'Auction end time has passed; listing remains unpublished'});
    const rows=await rest('marketplace_listings?id=eq.'+encodeURIComponent(publishMatch[1])+'&status=eq.pending_review',{method:'PATCH',body:JSON.stringify({status:'published',publication_gate:gate,updated_at:new Date().toISOString()})});
    if(!Array.isArray(rows)||!rows.length) return send(res,409,{error:'Listing is not pending review or could not be published'});
    if(auction) {
      const auctionStatus=Date.parse(auction.starts_at)>Date.now()?'scheduled':'live';
      await rest('marketplace_auctions?id=eq.'+encodeURIComponent(auction.id)+'&status=eq.pending_review',{method:'PATCH',body:JSON.stringify({status:auctionStatus,updated_at:new Date().toISOString()})});
    }
    await rpc('marketplace_append_ledger_event',{p_idempotency_key:'listing-published:'+publishMatch[1],p_event_type:'LISTING_PUBLISHED',p_subject_type:'listing',p_subject_id:publishMatch[1],p_actor_type:'human',p_actor_id:safeText(b.reviewed_by,160),p_economic_state:'OBSERVED',p_payload:{publication_gate:rows[0].publication_gate,auction_id:auction?.id||null}});
    return send(res,200,{listing_id:publishMatch[1],state:'published',message:'Listing published after explicit review; not evidence of buyer demand or revenue.'});
  }
  const offerMatch=requestPath.match(/^\/api\/marketplace\/v1\/rfqs\/([0-9a-f-]{36})\/offers$/i);
  if(req.method==='POST'&&offerMatch) {
    const supplier=await supplierIdentity(req); if(!supplier) return send(res,401,{error:'Registered supplier credential required'});
    if(!hasScope(supplier,'submit_offer')) return send(res,403,{error:'Supplier credential lacks submit_offer scope'});
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
    const buyer=await buyerIdentity(req); if(!buyer) return send(res,401,{error:'Registered buyer credential required'});
    if(!hasScope(buyer,'accept_offer')) return send(res,403,{error:'Buyer credential lacks accept_offer scope'});
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
    const buyer=await buyerIdentity(req); if(!buyer) return send(res,401,{error:'Registered buyer credential required'});
    if(!hasScope(buyer,'checkout')) return send(res,403,{error:'Buyer credential lacks checkout scope'});
    if(!uuid(checkoutMatch[1])) return send(res,400,{error:'Invalid order id'});
    if(STORE!=='supabase') return send(res,503,{error:'CHECKOUT_HELD: local ledger mode cannot prove external settlement. No charge was created.'});
    if(process.env.MARKETPLACE_ENABLE_CHECKOUT!=='true'||process.env.MARKETPLACE_PAYOUT_MODEL!=='stripe_connect_verified') return send(res,503,{error:'CHECKOUT_HELD: marketplace checkout remains disabled until Connect, refunds, tax and reconciliation are explicitly approved. No charge was created.'});
    const key=safeText(req.headers['idempotency-key'],160)||('checkout-prepared:'+checkoutMatch[1]);
    const prepared=await rpc('marketplace_prepare_checkout',{p_order_id:checkoutMatch[1],p_buyer_party_id:buyer.party_id,p_idempotency_key:key});
    if(prepared?.already_settled) return send(res,409,{error:'Order is already settled',order_id:prepared.order_id});
    if(!prepared?.seller_stripe_account_id||!Number.isSafeInteger(Number(prepared.amount_minor))||Number(prepared.amount_minor)<1) return send(res,503,{error:'Seller settlement configuration or order amount is incomplete; no charge was created.'});
    const base=(process.env.PUBLIC_BASE_URL||'https://dreamledger.org').replace(/\/$/,'');
    const fee=Math.floor(Number(prepared.amount_minor)*Number(prepared.application_fee_bps||500)/10000);
    const session=await stripePost('checkout/sessions',{
      mode:'payment',
      'line_items[0][price_data][currency]':String(prepared.currency||'NZD').toLowerCase(),
      'line_items[0][price_data][unit_amount]':Number(prepared.amount_minor),
      'line_items[0][price_data][product_data][name]':'DreamLedger marketplace order '+checkoutMatch[1].slice(0,8),
      'line_items[0][quantity]':1,
      success_url:base+'/marketplace.html?payment=return&session_id={CHECKOUT_SESSION_ID}',
      cancel_url:base+'/marketplace.html?payment=cancelled&order_id='+encodeURIComponent(checkoutMatch[1]),
      client_reference_id:checkoutMatch[1],
      'metadata[marketplace_order_id]':checkoutMatch[1],
      'metadata[dreamledger_sku]':'MARKETPLACE-ORDER',
      'payment_intent_data[metadata][marketplace_order_id]':checkoutMatch[1],
      'payment_intent_data[transfer_data][destination]':prepared.seller_stripe_account_id,
      'payment_intent_data[application_fee_amount]':fee
    },'marketplace-checkout:'+checkoutMatch[1]);
    if(!session.id||!session.url) throw Object.assign(new Error('Stripe did not return a usable Checkout Session'),{statusCode:502});
    await rpc('marketplace_attach_checkout_session',{p_order_id:checkoutMatch[1],p_session_id:session.id,p_idempotency_key:'checkout-session:'+checkoutMatch[1]});
    return send(res,200,{order_id:checkoutMatch[1],checkout_url:session.url,session_id:session.id,amount_minor:prepared.amount_minor,currency:prepared.currency,platform_fee_minor:fee,payment_state:'PENDING',message:'Checkout created. Revenue is not counted until the signed Stripe event confirms settlement and fulfillment evidence reconciles.'});
  }
  const deliveryMatch=requestPath.match(/^\/api\/marketplace\/v1\/orders\/([0-9a-f-]{36})\/delivery$/i);
  if(req.method==='POST'&&deliveryMatch) {
    const supplier=await supplierIdentity(req); if(!supplier) return send(res,401,{error:'Registered supplier credential required'});
    if(!hasScope(supplier,'submit_delivery')) return send(res,403,{error:'Supplier credential lacks submit_delivery scope'});
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
    const buyer=await buyerIdentity(req); if(!buyer) return send(res,401,{error:'Registered buyer credential required'});
    if(!hasScope(buyer,'accept_delivery')) return send(res,403,{error:'Buyer credential lacks accept_delivery scope'});
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
async function handleStripeWebhook(raw, signature) {
  let event;
  try { event=JSON.parse(raw); } catch { throw Object.assign(new Error('Invalid Stripe event JSON'),{statusCode:400}); }
  const type=String(event.type||''), object=event.data?.object||{};
  const orderId=String(object.metadata?.marketplace_order_id||'');
  const partyId=String(object.metadata?.marketplace_party_id||'');
  const isCheckout=['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(type)&&Boolean(orderId);
  const isConnectUpdate=type==='account.updated'&&Boolean(partyId);
  if(!isCheckout&&!isConnectUpdate) return {handled:false};
  if(isCheckout&&!uuid(orderId)) throw Object.assign(new Error('Invalid marketplace order metadata'),{statusCode:400});
  if(isConnectUpdate&&!uuid(partyId)) throw Object.assign(new Error('Invalid marketplace party metadata'),{statusCode:400});
  const secret=process.env.STRIPE_WEBHOOK_SECRET||process.env.STRIPE_WEBHOOK_SIGNING_SECRET||'';
  if(!secret) throw Object.assign(new Error('Marketplace Stripe webhook secret is not configured'),{statusCode:503});
  const parts=String(signature||'').split(',');
  const timestamp=(parts.find(x=>x.startsWith('t='))||'').slice(2);
  const signatures=parts.filter(x=>x.startsWith('v1=')).map(x=>x.slice(3));
  if(!timestamp||!signatures.length||Math.abs(Date.now()/1000-Number(timestamp))>300) throw Object.assign(new Error('Invalid or expired Stripe signature'),{statusCode:400});
  const expected=crypto.createHmac('sha256',secret).update(timestamp+'.'+raw,'utf8').digest('hex');
  const valid=signatures.some(s=>{const a=Buffer.from(s),b=Buffer.from(expected);return a.length===b.length&&crypto.timingSafeEqual(a,b);});
  if(!valid) throw Object.assign(new Error('Invalid Stripe signature'),{statusCode:400});
  if(STORE!=='supabase') throw Object.assign(new Error('Signed Stripe events require the selected Supabase ledger backend; local mode is not permitted to claim external settlement'),{statusCode:503});
  if(isConnectUpdate) {
    const accountId=String(object.id||'');
    if(!/^acct_[A-Za-z0-9]+$/.test(accountId)) throw Object.assign(new Error('Invalid Stripe connected account id'),{statusCode:400});
    const patch={stripe_account_id:accountId,stripe_charges_enabled:object.charges_enabled===true,stripe_payouts_enabled:object.payouts_enabled===true,stripe_details_submitted:object.details_submitted===true,updated_at:new Date().toISOString()};
    const rows=await rest('marketplace_parties?id=eq.'+encodeURIComponent(partyId),{method:'PATCH',body:JSON.stringify(patch)});
    if(!Array.isArray(rows)||!rows.length) return {handled:true,matched:false,state:'UNMATCHED',event_id:event.id};
    await rpc('marketplace_append_ledger_event',{p_idempotency_key:'connect-account-updated:'+String(event.id),p_event_type:'CONNECT_ACCOUNT_STATUS_UPDATED',p_subject_type:'marketplace_party',p_subject_id:partyId,p_actor_type:'stripe',p_actor_id:String(event.id),p_economic_state:'OBSERVED',p_payload:{stripe_account_id:accountId,charges_enabled:patch.stripe_charges_enabled,payouts_enabled:patch.stripe_payouts_enabled,details_submitted:patch.stripe_details_submitted}});
    return {handled:true,matched:true,connect_status:{charges_enabled:patch.stripe_charges_enabled,payouts_enabled:patch.stripe_payouts_enabled,details_submitted:patch.stripe_details_submitted}};
  }
  const session=object;
  if(session.payment_status!=='paid') return {handled:true,settled:false,reason:'payment_not_settled'};
  if(!event.id||!session.id||!Number.isSafeInteger(Number(session.amount_total))||!session.currency) throw Object.assign(new Error('Stripe session missing settlement fields'),{statusCode:400});
  const payload={event_id:event.id,event_type:type,session_id:session.id,payment_status:session.payment_status,amount_total:session.amount_total,currency:session.currency,metadata:session.metadata};
  const payloadHash=crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  const result=await rpc('marketplace_settle_checkout',{p_provider:'stripe',p_event_id:String(event.id),p_order_id:orderId,p_session_id:String(session.id),p_amount_minor:Number(session.amount_total),p_currency:String(session.currency).toUpperCase(),p_payload_hash:payloadHash,p_payload:payload});
  return {handled:true,...(result||{})};
}

module.exports={handle,handleStripeWebhook};
