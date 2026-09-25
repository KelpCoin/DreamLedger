'use strict';

const crypto = require('crypto');
const stripeProof = require('../lib/stripeWebhookProof');

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
const STRIPE_WEBHOOK_SECRET = String(process.env.STRIPE_WEBHOOK_SECRET || '');
const INTERNAL_TOKEN = String(process.env.DREAMLEDGER_AGENT_BRIDGE_TOKEN || '');
const RECONCILE_TOKEN = String(process.env.DREAMLEDGER_RECONCILE_TOKEN || '');
const STRIPE_SECRET_KEY = String(process.env.STRIPE_SECRET_KEY || process.env.STRIPE_LIVE_SECRET_KEY || '');

function json(res, status, data) {
  if (res.writableEnded) return true;
  res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  res.end(JSON.stringify(data));
  return true;
}

function requireConfig() {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw Object.assign(new Error('commercial persistence is not configured'), {statusCode:503});
}

async function db(method, table, query='', payload, prefer='return=representation') {
  requireConfig();
  const response = await fetch(SUPABASE_URL + '/rest/v1/' + table + query, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      Prefer: prefer
    },
    body: payload === undefined ? undefined : JSON.stringify(payload)
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = {raw:text}; }
  if (!response.ok) throw Object.assign(new Error('Supabase ' + table + ' failed (' + response.status + ')'), {statusCode:502, detail:data});
  return data;
}

async function rpc(name, args) {
  return db('POST','rpc/' + name,'',args,'return=representation');
}

function clean(v) { return String(v || '').trim().slice(0, 500); }

function verify(raw, signature) {
  stripeProof.verifyStripeSignature(raw, signature || '', STRIPE_WEBHOOK_SECRET);
}

async function stripeGet(pathname, params = {}) {
  if (!STRIPE_SECRET_KEY) throw Object.assign(new Error('Stripe secret key is not configured for reconciliation'), {statusCode:503});
  const u = new URL('https://api.stripe.com' + pathname);
  for (const [k,v] of Object.entries(params)) u.searchParams.append(k,String(v));
  const response = await fetch(u, {headers:{Authorization:'Basic '+Buffer.from(STRIPE_SECRET_KEY+':').toString('base64'),Accept:'application/json'}});
  const body = await response.text();
  let data; try { data = body ? JSON.parse(body) : null; } catch { data = {raw:body}; }
  if (!response.ok) throw Object.assign(new Error('Stripe API '+response.status), {statusCode:502, detail:data});
  return data;
}

async function reconcileFunds(sessionId) {
  const rows = await db('GET','economic_events','?select=event_id,silo_id,sku_id,offer_id,amount_nzd,stripe_checkout_session,stripe_payment_intent,payment_settled,fulfilment_verified,evidence_verified,verification_status,evidence&stripe_checkout_session=eq.'+encodeURIComponent(sessionId)+'&limit=1');
  const event = Array.isArray(rows) ? rows[0] : null;
  if (!event) return {handled:false, reason:'economic_event_not_found'};
  if (!event.stripe_payment_intent) return {handled:false, reason:'payment_intent_not_found'};
  if (event.payment_settled === true) return {handled:true, already_verified:true, event_id:event.event_id};
  const pi = await stripeGet('/v1/payment_intents/'+encodeURIComponent(event.stripe_payment_intent), {'expand[]':'latest_charge.balance_transaction'});
  if (pi.livemode !== true || pi.status !== 'succeeded') return {handled:true, funds_available:false, reason:'payment_not_live_succeeded',payment_intent:pi.id,status:pi.status};
  const charge = pi.latest_charge && typeof pi.latest_charge === 'object' ? pi.latest_charge : null;
  const bt = charge && charge.balance_transaction && typeof charge.balance_transaction === 'object' ? charge.balance_transaction : null;
  if (!bt) return {handled:true, funds_available:false, reason:'balance_transaction_not_expanded'};
  const expectedMinor = Math.round(Number(event.amount_nzd || 0) * 100);
  const validAmount = Number(bt.amount) === expectedMinor;
  const validCurrency = String(bt.currency || '').toLowerCase() === 'nzd';
  const available = bt.status === 'available' && Number(bt.available_on || 0) <= Math.floor(Date.now()/1000);
  if (!validAmount || !validCurrency || !available) return {handled:true, funds_available:false, reason:'balance_transaction_not_available',balance_transaction_id:bt.id,status:bt.status,available_on:bt.available_on,valid_amount:validAmount,valid_currency:validCurrency};
  const evidence = Object.assign({}, event.evidence || {}, {stripe_payment_intent:pi.id,stripe_charge_id:charge.id,stripe_balance_transaction:bt.id,stripe_balance_transaction_status:bt.status,stripe_available_on:bt.available_on,funds_available_verified_at:new Date().toISOString()});
  await db('PATCH','economic_events','?event_id=eq.'+encodeURIComponent(event.event_id),{payment_settled:true,evidence_verified:true,verification_status:'OBSERVED',resulting_state:'FUNDS_AVAILABLE',evidence},'return=minimal');
  const fulfillments = await db('GET','marketplace_fulfillments','?select=fulfillment_id,order_id,status,metadata&metadata->>stripe_checkout_session_id=eq.'+encodeURIComponent(sessionId)+'&limit=1');
  const fulfillment = Array.isArray(fulfillments) ? fulfillments[0] : null;
  if (fulfillment?.order_id) {
    await db('PATCH','marketplace_orders','?id=eq.'+encodeURIComponent(fulfillment.order_id),{order_state:'fulfillment',state_version:3,state_updated_at:new Date().toISOString()},'return=minimal');
    await db('POST','marketplace_order_state_events','',{order_id:fulfillment.order_id,from_state:'payment_succeeded',to_state:'fulfillment',state_version:3,idempotency_key:'funds:'+event.event_id,reason:'Stripe balance transaction is available'},'resolution=ignore-duplicates,return=minimal');
    await db('POST','marketplace_audit_events','',{entity_type:'order',entity_id:String(fulfillment.order_id),action:'STRIPE_FUNDS_AVAILABLE',from_state:'payment_succeeded',to_state:'fulfillment',idempotency_key:'funds:'+event.event_id,evidence_ref:'stripe:balance_transaction:'+bt.id,metadata:{stripe_balance_transaction:bt.id,available_on:bt.available_on}},'resolution=ignore-duplicates,return=minimal');
  }
  return {handled:true,funds_available:true,event_id:event.event_id,payment_intent:pi.id,charge_id:charge.id,balance_transaction_id:bt.id,available_on:bt.available_on,order_id:fulfillment?.order_id||null};
}

async function settleSession(session, event) {
  const sku = clean(session.metadata?.dreamledger_sku || session.metadata?.sku || session.metadata?.product_sku).toUpperCase();
  const offerId = clean(session.metadata?.offer_id);
  const silo = clean(session.metadata?.silo || 'dreamledger');
  const listingId = clean(session.metadata?.marketplace_listing_id || session.metadata?.listing_id);
  if (!sku) return {handled:false, reason:'no_dreamledger_sku'};
  if (session.payment_status !== 'paid') return {handled:true, ignored:true, reason:'payment_not_paid'};
  if (session.livemode !== true) return {handled:true, ignored:true, reason:'not_livemode'};
  if (String(session.currency || '').toLowerCase() !== 'nzd') return {handled:false, reason:'unsupported_currency'};
  const amount = Number(session.amount_total || 0) / 100;
  if (!Number.isFinite(amount) || amount <= 0) return {handled:false, reason:'invalid_amount'};

  let settlement = null;
  if (sku === 'COMMANDER-DECK-DIAGNOSTIC-001') {
    if (!listingId) throw Object.assign(new Error('diagnostic payment missing marketplace_listing_id'), {statusCode:400});
    settlement = await rpc('marketplace_settle_stripe_payment', {
      p_listing_id: listingId,
      p_checkout_session_id: clean(session.id),
      p_payment_intent_id: clean(session.payment_intent),
      p_event_id: clean(event.id),
      p_amount_nzd: amount,
      p_currency: 'NZD',
      p_customer_email: clean(session.customer_details?.email || session.customer_email),
      p_quantity: 1
    });
    const s = Array.isArray(settlement) ? settlement[0] : settlement;
    const orderId = s?.order_id || null;
    const fulfillmentId = s?.fulfillment_id || null;
    const evidenceRef = 'stripe:event:' + event.id;
    await db('POST','control_evidence','',{
      subject:'stripe:' + event.id,
      evidence_tier:'PRIMARY',
      evidence_type:'STRIPE_LIVE_CHECKOUT',
      source_reference:evidenceRef,
      source_snapshot:JSON.stringify({
        event_id:event.id,
        checkout_session_id:session.id,
        payment_intent:session.payment_intent || null,
        amount_nzd:amount,
        currency:'NZD',
        sku,
        offer_id:offerId || null,
        silo,
        customer_email:session.customer_details?.email || session.customer_email || null
      }),
      observed_at:new Date().toISOString(),
      verified_by:'stripe-live-webhook',
      verification_status:'verified',
      notes:'Live Stripe checkout.session.completed. Payment status paid. Awaiting independent fulfillment verification.'
    },'resolution=ignore-duplicates,return=representation');
    await db('POST','economic_events','',{
      event_id:event.id,
      silo_id:silo,
      sku_id:sku,
      offer_id:offerId || null,
      buyer_action_verified:true,
      payment_settled:false,
      fulfilment_verified:false,
      evidence_verified:true,
      amount_nzd:amount,
      stripe_checkout_session:session.id,
      stripe_payment_intent:session.payment_intent || null,
      evidence_ref:evidenceRef,
      actor:'stripe-live-webhook',
      source:'stripe',
      external_reference:session.id,
      prior_state:'PAYMENT_PENDING',
      resulting_state:'PAYMENT_SUCCEEDED',
      evidence:{
        stripe_event_id:event.id,
        stripe_checkout_session:session.id,
        stripe_payment_intent:session.payment_intent || null,
        marketplace_order_id:orderId,
        marketplace_fulfillment_id:fulfillmentId,
        livemode:true,
        external_buyer:Boolean(session.customer_details?.email || session.customer_email),
        payment_status:'paid',
        funds_available:false
      },
      verification_status:'OBSERVED',
      observation_mode:'OBSERVED',
      scope:'EXTERNAL'
    },'resolution=ignore-duplicates,return=minimal');
    return {handled:true,settlement:s,event_id:event.id,sku,order_id:orderId,fulfillment_id:fulfillmentId,economic_event_id:event.id};
  }
  return {handled:false,reason:'unsupported_sku',sku};
}

async function webhook(req,res) {
  if (req.method !== 'POST') return json(res,405,{error:'method not allowed'});
  let raw='';
  for await (const chunk of req) raw += chunk;
  try {
    verify(raw,req.headers['stripe-signature']);
    const event=JSON.parse(raw);
    if (event.livemode !== true) return json(res,200,{received:true,ignored:true,reason:'not_livemode'});
    if (!event.id) return json(res,400,{error:'missing event id'});
    if (event.type === 'balance.available') return json(res,200,{received:true,ignored:true,event_type:event.type,observation:'account_balance_changed; per-payment availability requires balance-transaction reconciliation'});
    if (event.type === 'payment_intent.succeeded' || event.type === 'charge.succeeded') return json(res,200,{received:true,ignored:true,event_type:event.type,observation:'payment_success_observed; awaiting per-payment funds availability reconciliation'});
    if (!['checkout.session.completed'].includes(event.type)) return json(res,200,{received:true,ignored:true,event_type:event.type});
    const existing=await db('GET','economic_events','?select=event_id&event_id=eq.'+encodeURIComponent(event.id)+'&limit=1');
    if (Array.isArray(existing) && existing.length) return json(res,200,{received:true,idempotent:true,event_id:event.id});
    const result=await settleSession(event.data?.object || {},event);
    return json(res,200,{received:true,...result});
  } catch (error) {
    return json(res,error.statusCode || 400,{received:false,error:String(error.message || error)});
  }
}

async function input(req,res) {
  if (req.method === 'GET') return json(res,405,{error:'POST required'});
  let raw='';
  for await (const chunk of req) raw += chunk;
  let body; try { body=JSON.parse(raw || '{}'); } catch { return json(res,400,{error:'invalid JSON'}); }
  const sessionId=clean(body.session_id);
  const email=clean(body.email).toLowerCase();
  const decklist=String(body.decklist || '').trim();
  if (!sessionId || !email || decklist.length < 20) return json(res,422,{error:'session_id, email and a decklist of at least 20 characters are required'});
  const rows=await db('GET','marketplace_fulfillments','?select=fulfillment_id,status,metadata&metadata->>stripe_checkout_session_id=eq.'+encodeURIComponent(sessionId)+'&limit=1');
  if (!Array.isArray(rows) || !rows[0]) return json(res,404,{error:'paid fulfillment not found'});
  const f=rows[0];
  const storedEmail=clean(f.metadata?.customer_email).toLowerCase();
  if (!storedEmail || storedEmail !== email) return json(res,403,{error:'customer identity mismatch'});
  await rpc('marketplace_submit_diagnostic_input',{p_fulfillment_id:f.fulfillment_id,p_customer_email:email,p_decklist:decklist});
  return json(res,202,{accepted:true,fulfillment_id:f.fulfillment_id,state:'INPUT_SUBMITTED',next:'automatic_fulfillment'});
}

async function reconcile(req,res) {
  if (req.method !== 'POST') return json(res,405,{error:'POST required'});
  if (!RECONCILE_TOKEN || String(req.headers['x-dreamledger-reconcile-token'] || '') !== RECONCILE_TOKEN) return json(res,401,{error:'unauthorized'});
  let raw=''; for await(const chunk of req) raw+=chunk;
  let body; try{body=JSON.parse(raw||'{}')}catch{return json(res,400,{error:'invalid JSON'})}
  const sessionId=clean(body.session_id);
  try {
    if (sessionId) return json(res,200,await reconcileFunds(sessionId));
    const pending = await db('GET','economic_events','?select=event_id,stripe_checkout_session&resulting_state=eq.PAYMENT_SUCCEEDED&payment_settled=eq.false&stripe_checkout_session=not.is.null&order=created_at.asc&limit=20');
    const results=[];
    for (const row of (Array.isArray(pending)?pending:[])) {
      try { results.push(await reconcileFunds(row.stripe_checkout_session)); }
      catch (error) { results.push({handled:false,event_id:row.event_id,error:String(error.message||error)}); }
    }
    return json(res,200,{handled:true,scanned:results.length,results});
  } catch(error) { return json(res,error.statusCode||500,{handled:false,error:String(error.message||error),detail:error.detail||null}); }
}

async function status(req,res) {
  const u=new URL(req.url || '/','http://localhost');
  const sessionId=clean(u.searchParams.get('session_id'));
  if (!sessionId) return json(res,422,{error:'session_id required'});
  const rows=await db('GET','marketplace_fulfillments','?select=fulfillment_id,status,delivery_url,evidence_ref,metadata&metadata->>stripe_checkout_session_id=eq.'+encodeURIComponent(sessionId)+'&limit=1');
  if (!Array.isArray(rows) || !rows[0]) return json(res,404,{error:'fulfillment not found'});
  const f=rows[0];
  const events=await db('GET','economic_events','?select=event_id,payment_settled,fulfilment_verified,evidence_verified,verification_status,evidence_ref,amount_nzd,stripe_checkout_session,stripe_payment_intent&stripe_checkout_session=eq.'+encodeURIComponent(sessionId)+'&limit=1');
  const claims=await db('GET','economic_agent_events','?select=event_id,agent_id,verb,output,result,timestamp,idempotency_key&task_id=eq.'+encodeURIComponent(sessionId)+'&order=timestamp.desc&limit=20');
  const event=events?.[0] || null;
  const truth=event ? {
    agent_claims_present:Array.isArray(claims)&&claims.length>0,
    external_evidence_present:Boolean(event.stripe_checkout_session&&event.stripe_payment_intent&&event.evidence_ref),
    payment_succeeded:event.resulting_state==='PAYMENT_SUCCEEDED'||event.resulting_state==='FUNDS_AVAILABLE',
    funds_available:event.resulting_state==='FUNDS_AVAILABLE'&&event.payment_settled===true,
    payment_settled:event.payment_settled===true,
    fulfillment_verified:event.fulfilment_verified===true,
    evidence_verified:event.evidence_verified===true,
    oracle_status:event.verification_status
  } : null;
  return json(res,200,{session_id:sessionId,fulfillment:f,economic_event:event,agent_claims:claims||[],cross_check:truth,truth_rule:'agent claims never certify external economic truth; Stripe + fulfillment evidence do'});
}

async function claim(req,res) {
  if (!INTERNAL_TOKEN || String(req.headers['x-dreamledger-agent-token'] || '') !== INTERNAL_TOKEN) return json(res,401,{error:'unauthorized'});
  let raw=''; for await(const chunk of req) raw+=chunk;
  let body; try{body=JSON.parse(raw||'{}')}catch{return json(res,400,{error:'invalid JSON'})}
  const sessionId=clean(body.session_id), claimType=clean(body.claim_type || 'agent_claim');
  if(!sessionId) return json(res,422,{error:'session_id required'});
  const eventId='agent-claim:'+sessionId+':'+crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex').slice(0,16);
  await db('POST','economic_agent_events','',{
    agent_id:clean(body.agent_id || 'commercial-controller'),
    task_id:sessionId,
    verb:claimType,
    capability:clean(body.capability || 'commercial'),
    objective:clean(body.objective || 'commercial-cell'),
    constraints:body.constraints || {},
    authorization_context:body.authorization_context || {},
    input_evidence:body.input_evidence || {},
    output:body.claim || {},
    result:body.result || {},
    idempotency_key:eventId
  },'resolution=ignore-duplicates,return=minimal');
  return json(res,202,{accepted:true,event_id:eventId,claim_recorded:true});
}

async function handle(req,res,path) {
  if (path === '/api/webhooks/stripe') return webhook(req,res);
  if (path === '/api/commercial/input') return input(req,res);
  if (path === '/api/commercial/status') return status(req,res);
  if (path === '/api/commercial/reconcile') return reconcile(req,res);
  if (path === '/api/commercial/claim') return claim(req,res);
  return false;
}

module.exports={handle};
