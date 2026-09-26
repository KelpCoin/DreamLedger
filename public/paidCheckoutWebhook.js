'use strict';

const crypto = require('crypto');

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
const WEBHOOK_SECRET = String(process.env.STRIPE_WEBHOOK_SIGNING_SECRET || process.env.STRIPE_WEBHOOK_SECRET || '');

function parseStripeSignature(header) {
  const parts = String(header || '').split(',');
  const out = {timestamp:null, signatures:[]};
  for (const p of parts) {
    const [k,v] = p.split('=');
    if (k === 't') out.timestamp = v;
    if (k === 'v1' && v) out.signatures.push(v);
  }
  return out;
}

function verify(rawBody, header) {
  if (!WEBHOOK_SECRET) throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
  const parsed = parseStripeSignature(header);
  if (!parsed.timestamp || !parsed.signatures.length) throw new Error('Invalid Stripe signature');
  const age = Math.abs(Math.floor(Date.now()/1000) - Number(parsed.timestamp));
  if (!Number.isFinite(age) || age > 300) throw new Error('Expired Stripe signature');
  const expected = crypto.createHmac('sha256', WEBHOOK_SECRET)
    .update(String(parsed.timestamp) + '.' + rawBody)
    .digest('hex');
  if (!parsed.signatures.some(s => s.length === expected.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected)))) {
    throw new Error('Invalid Stripe signature');
  }
}

async function db(path, options={}) {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Supabase configuration unavailable');
  const response = await fetch(SUPABASE_URL + path, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  if (!response.ok) throw new Error('Supabase HTTP ' + response.status + ': ' + text.slice(0,300));
  return text ? JSON.parse(text) : null;
}

async function persistPaidCheckout(event) {
  const session = event?.data?.object;
  if (!session || event.type !== 'checkout.session.completed' || session.payment_status !== 'paid') {
    return {handled:false};
  }

  const metadata = session.metadata || {};
  const clientReferenceId = String(session.client_reference_id || '');
  const hypothesisId = String(metadata.hypothesis_id || (clientReferenceId.startsWith('HYP-') ? clientReferenceId : ''));
  const isHypothesis = String(metadata.sku_id || '') === 'HYPOTHESIS-COMMISSION-001' || hypothesisId.startsWith('HYP-');
  if (!isHypothesis) return {handled:false};
  const sku = 'HYPOTHESIS-COMMISSION-001';
  const siloId = hypothesisId.startsWith('HYP-') ? hypothesisId.slice(4) : String(metadata.silo_id || '');

  const existing = await db('/rest/v1/stripe_webhook_events?event_id=eq.' + encodeURIComponent(event.id) + '&select=event_id,processed&limit=1');
  if (Array.isArray(existing) && existing[0]?.processed) return {handled:true,duplicate:true,event_id:event.id};

  await db('/rest/v1/stripe_webhook_events', {
    method:'POST',
    headers:{Prefer:'resolution=merge-duplicates,return=minimal'},
    body:JSON.stringify({
      event_id:event.id,
      event_type:event.type,
      processed:false,
      payload:event
    })
  });

  const amountMinor = Number(session.amount_total || 0);
  const currency = String(session.currency || 'nzd').toUpperCase();
  const amountNzd = currency === 'NZD' ? Math.round(amountMinor) / 100 : 0;
  const customerEmail = session.customer_details?.email || session.customer_email || null;
  const paymentIntent = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id || null;

  const orderRows = await db('/rest/v1/revenue_orders?stripe_checkout_session_id=eq.' + encodeURIComponent(session.id) + '&select=id&limit=1');
  let orderId = Array.isArray(orderRows) && orderRows[0]?.id;

  if (!orderId) {
    const orders = await db('/rest/v1/revenue_orders', {
      method:'POST',
      headers:{Prefer:'return=representation'},
      body:JSON.stringify({
        stripe_event_id:event.id,
        stripe_checkout_session_id:session.id,
        stripe_payment_intent_id:paymentIntent,
        stripe_customer_id:typeof session.customer === 'string' ? session.customer : session.customer?.id || null,
        sku_id:sku,
        amount_nzd:amountNzd,
        currency,
        customer_email:customerEmail,
        status:'paid',
        paid_at:new Date((event.created || Math.floor(Date.now()/1000))*1000).toISOString(),
        raw_event:event
      })
    });
    orderId = orders?.[0]?.id;
  }

  if (!orderId) throw new Error('Revenue order was not created');

  const fulfillmentKey = 'hypothesis:' + String(hypothesisId || session.id);
  const entitlementRows = await db('/rest/v1/revenue_entitlements?order_id=eq.' + encodeURIComponent(orderId) + '&select=id&limit=1');
  let entitlementId = Array.isArray(entitlementRows) && entitlementRows[0]?.id;

  if (!entitlementId) {
    const entitlements = await db('/rest/v1/revenue_entitlements', {
      method:'POST',
      headers:{Prefer:'return=representation'},
      body:JSON.stringify({
        order_id:orderId,
        sku_id:sku,
        fulfillment_key:fulfillmentKey,
        status:'ready'
      })
    });
    entitlementId = entitlements?.[0]?.id;
  }

  if (entitlementId) {
    const requests = await db('/rest/v1/fulfillment_requests?entitlement_id=eq.' + encodeURIComponent(entitlementId) + '&select=id&limit=1');
    if (!Array.isArray(requests) || !requests[0]) {
      await db('/rest/v1/fulfillment_requests', {
        method:'POST',
        headers:{Prefer:'return=minimal'},
        body:JSON.stringify({
          entitlement_id:entitlementId,
          sku_id:sku,
          customer_email:customerEmail,
          payload:{
            type:'hypothesis_research_request',
            hypothesis_id:hypothesisId || null,
            silo_id:siloId || null,
            stripe_checkout_session_id:session.id,
            source_basis:metadata.source_basis || 'UNKNOWN'
          },
          status:'queued',
          canonical_state:'QUEUED',
          manual_fulfillment:false,
          fulfillment_reference:'stripe:' + session.id,
          evidence_status:'UNVERIFIED'
        })
      });
    }
  }

  await db('/rest/v1/stripe_webhook_events?event_id=eq.' + encodeURIComponent(event.id), {
    method:'PATCH',
    headers:{Prefer:'return=minimal'},
    body:JSON.stringify({processed:true,processed_at:new Date().toISOString()})
  });

  return {handled:true,event_id:event.id,order_id:orderId,entitlement_id:entitlementId,sku_id:sku,amount_nzd:amountNzd,fulfillment_queued:true};
}

module.exports = { verify, persistPaidCheckout };
