'use strict';

const crypto = require('crypto');

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const VERIFY_SIGNING_SECRET = process.env.DREAMLEDGER_VERIFY_SIGNING_SECRET || '';

function send(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(body));
}

function canonical(value) {
  return JSON.stringify(value, Object.keys(value || {}).sort());
}

function hash(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function signature(value) {
  if (!VERIFY_SIGNING_SECRET) return null;
  return crypto.createHmac('sha256', VERIFY_SIGNING_SECRET).update(value, 'utf8').digest('hex');
}

async function body(req) {
  let data = '';
  for await (const chunk of req) {
    data += chunk;
    if (data.length > 100000) throw new Error('Request too large');
  }
  return JSON.parse(data || '{}');
}

async function query(path) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('verification datastore is not configured');
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
    }
  });
  if (!response.ok) throw new Error(`verification datastore query failed (${response.status})`);
  return response.json();
}

function first(rows) {
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

function amountMinor(row) {
  if (!row) return null;
  if (row.amount_minor != null) return Number(row.amount_minor);
  if (row.amount_nzd != null) return Math.round(Number(row.amount_nzd) * 100);
  if (row.amount != null) {
    const n = Number(row.amount);
    return Number.isFinite(n) ? (n < 1000 ? Math.round(n * 100) : Math.round(n)) : null;
  }
  return null;
}

async function verifySettlement(input) {
  const orderId = String(input.evidence?.order_id || input.order_id || '').trim();
  const claimedAmount = input.evidence?.amount_minor == null ? null : Number(input.evidence.amount_minor);
  const claimedCurrency = String(input.evidence?.currency || 'nzd').toLowerCase();

  if (!orderId) throw new Error('evidence.order_id is required');
  if (claimedAmount != null && (!Number.isFinite(claimedAmount) || claimedAmount <= 0)) throw new Error('evidence.amount_minor must be a positive number');
  if (claimedCurrency !== 'nzd') throw new Error('only NZD marketplace settlement verification is enabled in v1');

  const orders = await query(`marketplace_orders?id=eq.${encodeURIComponent(orderId)}&select=*`);
  const order = first(orders);
  if (!order) {
    return {
      verified: false,
      settlement_confirmed: false,
      verdict: 'UNVERIFIED',
      reason: 'order_not_found',
      order_id: orderId
    };
  }

  const payments = await query(`marketplace_payments?order_id=eq.${encodeURIComponent(orderId)}&select=*`);
  const payment = first(payments);
  const transfers = await query(`marketplace_transfers?order_id=eq.${encodeURIComponent(orderId)}&select=*`);
  const transfer = first(transfers);

  const paymentPaid = String(payment?.status || '').toLowerCase() === 'paid';
  const transferSettled = ['created', 'paid', 'succeeded'].includes(String(transfer?.status || '').toLowerCase());
  const orderAmount = amountMinor(order);
  const paymentAmount = amountMinor(payment);
  const transferAmount = amountMinor(transfer);
  const expectedAmount = claimedAmount ?? orderAmount ?? paymentAmount;
  const amountsMatch = expectedAmount != null
    && [orderAmount, paymentAmount, transferAmount].filter(x => x != null).every(x => x === expectedAmount);

  const evidence = {
    order_id: orderId,
    order_found: true,
    payment_id: payment?.payment_id || payment?.id || null,
    payment_status: payment?.status || null,
    payment_paid: paymentPaid,
    transfer_id: transfer?.stripe_transfer_id || null,
    transfer_status: transfer?.status || null,
    transfer_settled: transferSettled,
    order_amount_minor: orderAmount,
    payment_amount_minor: paymentAmount,
    transfer_amount_minor: transferAmount,
    claimed_amount_minor: claimedAmount,
    currency: claimedCurrency,
    amounts_match: amountsMatch
  };

  const verified = paymentPaid && transferSettled && amountsMatch;
  const verdict = verified ? 'VERIFIED' : 'CONTRADICTED';
  const result = {
    type: 'dreamledger-settlement-verification',
    version: '1.0',
    verified,
    settlement_confirmed: verified,
    verdict,
    claim: String(input.claim || `Order ${orderId} was paid and seller settlement was confirmed.`),
    amount_minor: expectedAmount,
    amount: expectedAmount == null ? null : expectedAmount / 100,
    currency: claimedCurrency,
    order_id: orderId,
    evidence,
    verified_at: new Date().toISOString()
  };

  const canonicalResult = canonical(result);
  result.verification_id = `DLV-${hash(canonicalResult).slice(0, 24).toUpperCase()}`;
  result.evidence_hash = hash(canonicalResult);
  result.signature = signature(canonical(result));
  result.signature_status = result.signature ? 'HMAC_SHA256_CONFIGURED' : 'UNSIGNED_PREVIEW';

  return result;
}

async function handle(req, res, url) {
  if (url !== '/m2m/v1/verify-settlement') return false;

  if (req.method === 'GET') {
    return send(res, 200, {
      service: 'dreamledger-verify',
      version: '1.0',
      status: 'ready',
      pricing_status: 'X402_NOT_YET_ENABLED',
      verification_type: 'marketplace_settlement',
      signature_status: VERIFY_SIGNING_SECRET ? 'HMAC_SHA256_CONFIGURED' : 'UNSIGNED_PREVIEW'
    });
  }

  if (req.method !== 'POST') return send(res, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'POST only' } });

  try {
    const input = await body(req);
    const result = await verifySettlement(input);
    return send(res, 200, result);
  } catch (err) {
    return send(res, 400, {
      error: {
        code: 'VERIFICATION_FAILED',
        message: err.message || 'Settlement verification failed'
      }
    });
  }
}

module.exports = { handle, verifySettlement };