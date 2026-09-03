'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const stripeProof = require('../lib/stripeWebhookProof');

const ROOT = path.join(__dirname, '..');
const PRICING = path.join(ROOT, 'catalog', 'truth-oracle', 'pricing.json');
const DATA_ROOT = process.env.DREAMIEZ_DATA_DIR || ((fs.existsSync('/var/data') && fs.statSync('/var/data').isDirectory()) ? '/var/data/dreamiez' : path.join(ROOT, 'data', 'dreamiez'));
const BILLING_STATE = path.join(DATA_ROOT, 'truth-oracle-billing.json');
const PUBLIC_BASE = (process.env.PUBLIC_BASE_URL || 'https://dreamledger.org').replace(/\/$/, '');
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const COOKIE = 'dreamiez_session';

function read(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function write(file, value) { fs.mkdirSync(path.dirname(file), {recursive:true}); const tmp=file+'.tmp-'+process.pid+'-'+Date.now(); fs.writeFileSync(tmp, JSON.stringify(value,null,2)+'\n'); fs.renameSync(tmp,file); }
function send(res, status, body) { if (res.writableEnded) return true; res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify(body)); return true; }
function form(params) { const out = new URLSearchParams(); for (const [key,value] of Object.entries(params)) out.set(key,String(value)); return out; }
function plans() { return read(PRICING).plans || []; }
function paidPlan(tier) { return plans().find(p => p.tier === tier && Number(p.price_nzd_month) > 0 && p.stripe_price_id) || null; }
function getCookie(req,name) { const raw=String(req.headers.cookie||''); const match=raw.match(new RegExp('(?:^|;\\s*)'+name+'=([^;]+)')); return match ? decodeURIComponent(match[1]) : null; }
function currentUser(req) { const sessionId=getCookie(req,COOKIE); if(!sessionId)return null; try { const users=read(path.join(DATA_ROOT,'users.json')); return Array.isArray(users) ? users.find(u => u.id===sessionId && u.email) || null : null; } catch { return null; } }
function billing() { try { const state=read(BILLING_STATE); return state && typeof state==='object' ? state : {}; } catch { return {}; } }
function saveBilling(state) { write(BILLING_STATE,state); }
function getEntitlement(userId) {
  const record=billing()[userId];
  if(!record || record.environment!=='live' || record.status!=='active') return {tier:'public',expires_at:null};
  if(record.expires_at && Date.parse(record.expires_at) <= Date.now()) return {tier:'public',expires_at:record.expires_at};
  return {tier:record.tier || 'public',expires_at:record.expires_at || null};
}
async function stripeGet(endpoint) {
  if(!STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not configured');
  const response=await fetch('https://api.stripe.com/v1/'+endpoint,{headers:{Authorization:'Bearer '+STRIPE_SECRET_KEY}});
  const text=await response.text(); let data; try{data=JSON.parse(text);}catch{data={raw:text};}
  if(!response.ok)throw new Error(data?.error?.message||'Stripe API '+response.status); return data;
}
async function stripePost(endpoint,params,idempotencyKey) {
  if(!STRIPE_SECRET_KEY)throw new Error('STRIPE_SECRET_KEY is not configured');
  const response=await fetch('https://api.stripe.com/v1/'+endpoint,{method:'POST',headers:{Authorization:'Bearer '+STRIPE_SECRET_KEY,'Content-Type':'application/x-www-form-urlencoded','Idempotency-Key':idempotencyKey},body:form(params)});
  const text=await response.text(); let data; try{data=JSON.parse(text);}catch{data={raw:text};}
  if(!response.ok)throw new Error(data?.error?.message||'Stripe API '+response.status); return data;
}
function isoFromUnix(value) { return Number.isFinite(Number(value)) ? new Date(Number(value)*1000).toISOString() : null; }
function rememberEvent(record,event) { const events={...(record.provider_events||{})}; events[event.id]={type:event.type,timestamp:event.created||null,livemode:event.livemode===true,processed_at:new Date().toISOString()}; const ids=Object.keys(events); while(ids.length>100){delete events[ids.shift()];} record.provider_events=events; record.last_provider_event_id=event.id; return record; }

async function handle(req,res,url) {
  if(req.method==='GET'&&url==='/api/truth-oracle/plans') return send(res,200,{plans:plans().map(p=>({tier:p.tier,display_name:p.display_name||p.tier,price_nzd_month:Number(p.price_nzd_month),disclosure_class:p.disclosure_class,description:p.description}))});
  if(req.method==='GET'&&url==='/api/truth-oracle/entitlement') {
    const user=currentUser(req); if(!user)return send(res,401,{error:'authentication_required'});
    return send(res,200,{entitlement:getEntitlement(user.id),truth_unchanged:true});
  }
  if(req.method==='POST'&&url==='/api/truth-oracle/checkout') {
    const user=currentUser(req); if(!user)return send(res,401,{error:'authentication_required'});
    let raw=''; for await(const chunk of req){raw+=chunk;if(raw.length>20000)return send(res,413,{error:'Request too large'});}
    let body={};try{body=JSON.parse(raw||'{}');}catch{return send(res,400,{error:'Invalid JSON'});}
    const plan=paidPlan(String(body.tier||'')); if(!plan)return send(res,400,{error:'Unknown or unavailable Truth Oracle tier'});
    try {
      const session=await stripePost('checkout/sessions',{
        mode:'subscription',
        client_reference_id:user.id,
        'line_items[0][price]':plan.stripe_price_id,
        'line_items[0][quantity]':'1',
        customer_email:user.email,
        success_url:PUBLIC_BASE+'/truth-oracle?checkout=success&session_id={CHECKOUT_SESSION_ID}',
        cancel_url:PUBLIC_BASE+'/truth-oracle?checkout=cancelled',
        allow_promotion_codes:'true',
        'metadata[silo]':'truth-oracle',
        'metadata[user_id]':user.id,
        'metadata[truth_oracle_tier]':plan.tier,
        'metadata[disclosure_class]':plan.disclosure_class,
        'subscription_data[metadata][silo]':'truth-oracle',
        'subscription_data[metadata][user_id]':user.id,
        'subscription_data[metadata][truth_oracle_tier]':plan.tier,
        'subscription_data[metadata][disclosure_class]':plan.disclosure_class
      },'dreamledger-truth-checkout-'+user.id+'-'+plan.tier+'-'+crypto.randomUUID());
      return send(res,200,{ok:true,tier:plan.tier,session_id:session.id,checkout_url:session.url});
    }catch(err){return send(res,502,{error:err.message});}
  }
  if(req.method==='GET'&&url==='/api/truth-oracle/access') {
    const user=currentUser(req); if(!user)return send(res,401,{error:'authentication_required'});
    const entitlement=getEntitlement(user.id); return send(res,200,{authenticated:true,entitled:entitlement.tier!=='public',tier:entitlement.tier,expires_at:entitlement.expires_at,truth_unchanged:true});
  }
  return false;
}

async function handleStripeWebhook(raw,signature) {
  stripeProof.verifyStripeSignature(raw,signature,process.env.STRIPE_WEBHOOK_SECRET||'');
  let event; try{event=JSON.parse(raw);}catch{throw Object.assign(new Error('Invalid JSON payload'),{statusCode:400});}
  const object=event?.data?.object||{};
  const metadata=object.metadata||{};
  if(metadata.silo!=='truth-oracle')return {handled:false};
  const environment=event.livemode===true?'live':'test';
  const state=billing();
  let userId=String(metadata.user_id||object.client_reference_id||'');
  const subscriptionId=typeof object.subscription==='string'?object.subscription:(object.subscription?.id||null);
  if(!userId && subscriptionId && STRIPE_SECRET_KEY) {
    const subscription=await stripeGet('subscriptions/'+encodeURIComponent(subscriptionId));
    const sm=subscription.metadata||{}; userId=String(sm.user_id||'');
  }
  if(!userId)throw Object.assign(new Error('Truth Oracle billing event missing account association'),{statusCode:400});
  const existing=state[userId]||{};
  if(existing.provider_events && existing.provider_events[event.id]) return {handled:true,idempotent:true,provider_event_id:event.id};
  let record={...existing};
  if(event.type==='checkout.session.completed') {
    if(object.mode!=='subscription'||object.payment_status!=='paid')return {handled:true,ignored:true,reason:'payment_not_paid'};
    const tier=String(metadata.truth_oracle_tier||''); if(!paidPlan(tier))throw Object.assign(new Error('Unknown Truth Oracle tier in provider event'),{statusCode:400});
    let subscription=null; if(subscriptionId && STRIPE_SECRET_KEY) subscription=await stripeGet('subscriptions/'+encodeURIComponent(subscriptionId));
    record={...record,tier,status:'active',environment,customer_id:object.customer||null,subscription_id:subscriptionId,expires_at:isoFromUnix(subscription?.current_period_end),updated_at:new Date().toISOString()};
    record=rememberEvent(record,event); state[userId]=record; saveBilling(state); return {handled:true,economic_state:'ENTITLEMENT_GRANTED',provider_event_id:event.id,environment};
  }
  if(event.type==='invoice.paid') {
    const subscription=subscriptionId&&STRIPE_SECRET_KEY?await stripeGet('subscriptions/'+encodeURIComponent(subscriptionId)):null;
    const tier=String(metadata.truth_oracle_tier||subscription?.metadata?.truth_oracle_tier||existing.tier||'');
    const resolvedUser=String(metadata.user_id||subscription?.metadata?.user_id||userId);
    if(!paidPlan(tier))return {handled:true,ignored:true,reason:'unknown_tier'};
    record={...record,tier,status:'active',environment,customer_id:object.customer||existing.customer_id,subscription_id:subscriptionId||existing.subscription_id,expires_at:isoFromUnix(subscription?.current_period_end),updated_at:new Date().toISOString()};
    record=rememberEvent(record,event); state[resolvedUser]=record; saveBilling(state); return {handled:true,economic_state:'PAYMENT_SUCCEEDED',provider_event_id:event.id,environment};
  }
  if(event.type==='invoice.payment_failed') {
    record={...record,status:'past_due',environment,updated_at:new Date().toISOString()}; record=rememberEvent(record,event); state[userId]=record; saveBilling(state); return {handled:true,economic_state:'PAYMENT_FAILED',provider_event_id:event.id,environment};
  }
  if(event.type==='customer.subscription.updated') {
    const tier=String(metadata.truth_oracle_tier||existing.tier||'');
    const status=String(object.status||'');
    const active=['active','trialing'].includes(status);
    record={...record,tier:paidPlan(tier)?tier:(existing.tier||'public'),status:active?'active':status,environment,customer_id:object.customer||existing.customer_id,subscription_id:object.id||existing.subscription_id,expires_at:isoFromUnix(object.current_period_end),cancel_at_period_end:object.cancel_at_period_end===true,updated_at:new Date().toISOString()};
    record=rememberEvent(record,event); state[userId]=record; saveBilling(state); return {handled:true,economic_state:active?'ENTITLEMENT_GRANTED':'BILLING_STATE_UPDATED',provider_event_id:event.id,environment};
  }
  if(event.type==='customer.subscription.deleted') {
    record={...record,status:'canceled',environment,subscription_id:object.id||existing.subscription_id,updated_at:new Date().toISOString(),expires_at:new Date().toISOString()}; record=rememberEvent(record,event); state[userId]=record; saveBilling(state); return {handled:true,economic_state:'REVOKED',provider_event_id:event.id,environment};
  }
  record=rememberEvent(record,event); state[userId]=record; saveBilling(state); return {handled:true,ignored:true,reason:'unsupported_event',provider_event_id:event.id,environment};
}

module.exports={handle,handleStripeWebhook,getEntitlement};
