'use strict';

const crypto = require('crypto');

const SUPABASE_URL = String(process.env.DREAMLEDGER_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_KEY = process.env.DREAMLEDGER_SUPABASE_KEY || process.env.SUPABASE_SECRET_KEY || '';

function configured() {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

async function request(path, method, body) {
  if (!configured()) throw new Error('DreamLedger Supabase marketplace bridge is not configured');
  const response = await fetch(SUPABASE_URL + '/rest/v1/' + path, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!response.ok) throw new Error('Supabase marketplace bridge ' + response.status + ': ' + (data?.message || data?.error || text));
  return data;
}

async function rpc(name, args) {
  return request('rpc/' + name, 'POST', args);
}

function transactionKey(prefix, value) {
  return prefix + '-' + crypto.createHash('sha256').update(String(value), 'utf8').digest('hex').slice(0, 40);
}

async function createOrder({ cart, session }) {
  const items = Array.isArray(cart?.items) ? cart.items : [];
  if (!items.length) throw new Error('Cannot project an empty cart');
  const amountMinor = Number(session?.amount_total ?? cart.items.reduce((sum, item) => sum + Number(item.unit_amount) * Number(item.quantity || 1), 0));
  if (!Number.isFinite(amountMinor) || amountMinor < 0) throw new Error('Invalid settled-order amount');
  const sellerIds = [...new Set(items.map(item => item.seller_id).filter(Boolean))];
  const listingIds = [...new Set(items.map(item => item.listing_id).filter(Boolean))];
  const row = {
    buyer_user_id: cart.buyer_user_id || null,
    listing_id: listingIds.length === 1 ? listingIds[0] : null,
    seller_id: sellerIds.length === 1 ? sellerIds[0] : null,
    source_silo: String(items[0].silo || 'default'),
    amount_nzd: amountMinor / 100,
    platform_fee_nzd: Number(cart.platform_fee_minor || 0) / 100,
    seller_amount_nzd: (amountMinor - Number(cart.platform_fee_minor || 0)) / 100,
    payment_status: 'pending',
    fulfillment_status: 'pending',
    order_state: 'payment_pending',
    idempotency_key: transactionKey('cart', cart.id),
    checkout_session_id: session.id || null
  };
  const rows = await request('marketplace_orders', 'POST', row);
  return Array.isArray(rows) ? rows[0] : rows;
}

async function markPaid(order, session) {
  return rpc('transition_marketplace_order', {
    p_order_id: order.id,
    p_expected_version: Number(order.state_version),
    p_to_state: 'paid',
    p_actor_user_id: null,
    p_actor_org_id: null,
    p_idempotency_key: transactionKey('paid', session.id),
    p_reason: 'Stripe checkout.session.completed with payment_status=paid'
  });
}

async function enqueueFulfillment(order) {
  const runId = crypto.randomUUID();
  const row = {
    run_id: runId,
    role: 'executor',
    tier: 'local',
    objective: 'marketplace.fulfill_order',
    input: { order_id: order.id, listing_id: order.listing_id || null, checkout_session_id: order.checkout_session_id || null },
    required_output_schema: 'dreamledger/fulfillment-result/v1',
    timeout_seconds: 300,
    max_turns: 1,
    max_tool_calls: 3,
    retry_policy_json: { max_attempts: 3, backoff_seconds: 30 },
    status: 'queued'
  };
  const rows = await request('orchestrator_tasks', 'POST', row);
  return Array.isArray(rows) ? rows[0] : rows;
}

module.exports = { configured, createOrder, markPaid, enqueueFulfillment };
