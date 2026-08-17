const crypto = require('crypto');

const OFFER_ID = 'DREAMLEDGER-BILLBOARD-100X100-NZD29';
const SKU = 'DL-BILLBOARD-100X100-001';
const PAYMENT_URL = 'https://buy.stripe.com/28EcN54zraG13M3g3idwc1t';

function parseSignature(header) {
  const out = {};
  for (const part of String(header || '').split(',')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i)] = part.slice(i + 1);
  }
  return out;
}

function verifyStripeSignature(payload, header, secret, toleranceSeconds = 300) {
  const sig = parseSignature(header);
  if (!sig.t || !sig.v1 || !secret) return false;
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(sig.t));
  if (!Number.isFinite(age) || age > toleranceSeconds) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${sig.t}.${payload}`, 'utf8').digest('hex');
  return sig.v1.split(';').some((candidate) => {
    try {
      return crypto.timingSafeEqual(Buffer.from(candidate, 'utf8'), Buffer.from(expected, 'utf8'));
    } catch (_) {
      return false;
    }
  });
}

function signStripePayload(payload, secret, timestampSeconds = Math.floor(Date.now() / 1000)) {
  const v1 = crypto.createHmac('sha256', secret).update(`${timestampSeconds}.${payload}`, 'utf8').digest('hex');
  return `t=${timestampSeconds},v1=${v1}`;
}

async function readRawBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return Buffer.from(req.body, 'utf8');
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

const idempotencyKey = (eventId) => `billboard:stripe:event:${eventId}`;

/** Injected store for tests. Production uses Vercel KV. */
let _store = null;

function setIdempotencyStore(store) {
  _store = store;
}

function createMemoryStore() {
  const mem = new Map();
  return {
    async get(key) {
      return mem.has(key) ? mem.get(key) : null;
    },
    async set(key, value) {
      mem.set(key, value);
    }
  };
}

function getStore() {
  if (_store) return _store;
  if (process.env.BILLBOARD_IDEMPOTENCY_BACKEND === 'memory') {
    _store = createMemoryStore();
    return _store;
  }
  // Durable path: Vercel KV (requires KV_REST_API_URL + KV_REST_API_TOKEN)
  // eslint-disable-next-line global-require
  const { kv } = require('@vercel/kv');
  _store = kv;
  return _store;
}

async function eventAlreadyProcessed(eventId) {
  if (!eventId) return false;
  const existing = await getStore().get(idempotencyKey(eventId));
  return existing === 'processed';
}

async function markEventProcessed(eventId) {
  if (!eventId) throw new Error('MISSING_EVENT_ID');
  await getStore().set(idempotencyKey(eventId), 'processed');
}

/**
 * Durable payment record write.
 * Today: returns the record (caller persists via response + future ledger).
 * Failures must throw so handler returns 500 and Stripe retries.
 */
async function createPaymentRecord(eventRecord) {
  if (!eventRecord || !eventRecord.external_event_id) {
    throw new Error('INVALID_PAYMENT_RECORD');
  }
  // Placeholder for durable ledger/DB write. Must succeed before markEventProcessed.
  return eventRecord;
}

async function handler(req, res) {
  // 0. Method gate
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const raw = await readRawBody(req);
  const signature = req.headers['stripe-signature'];
  const payload = raw.toString('utf8');

  // 1-2. Verify signature; 400 on failure
  if (!verifyStripeSignature(payload, signature, secret)) {
    return res.status(400).json({ ok: false, error: 'INVALID_STRIPE_SIGNATURE' });
  }

  // 3. Parse only after verification
  let event;
  try {
    event = JSON.parse(payload);
  } catch (_) {
    return res.status(400).json({ ok: false, error: 'INVALID_JSON' });
  }

  // 4. Ignore non-target types
  if (event.type !== 'checkout.session.completed') {
    return res.status(200).json({ ok: true, ignored: true, event_type: event.type || null });
  }

  const session = event.data && event.data.object ? event.data.object : {};
  const paymentStatus = session.payment_status;
  const eventId = event.id || null;

  // 5. Paid gate only
  if (paymentStatus !== 'paid') {
    return res.status(200).json({
      ok: true,
      accepted: false,
      reason: 'PAYMENT_NOT_PAID',
      external_event_id: eventId
    });
  }

  try {
    // 6-7. Idempotency
    if (await eventAlreadyProcessed(eventId)) {
      return res.status(200).json({
        ok: true,
        accepted: false,
        duplicate: true,
        external_event_id: eventId
      });
    }

    const eventRecord = {
      event_type: 'VERIFIED_EXTERNAL_EVENT',
      external_event_id: eventId,
      provider: 'stripe',
      stripe_event_type: event.type,
      payment_status: paymentStatus,
      offer_id: OFFER_ID,
      sku: SKU,
      amount_nzd: 29,
      currency: 'NZD',
      payment_url: PAYMENT_URL,
      checkout_session_id: session.id || null,
      customer_email:
        session.customer_details && session.customer_details.email
          ? session.customer_details.email
          : null,
      fulfilment_state: 'PAID_PENDING_FULFILMENT',
      proof_required: true,
      fossil_required: true,
      timestamp_utc: new Date().toISOString()
    };

    // 8. Durable write first
    await createPaymentRecord(eventRecord);

    // 9. Mark processed only after durable write succeeds
    await markEventProcessed(eventId);

    // 10. 200 only after both succeed
    return res.status(200).json({
      ok: true,
      accepted: true,
      duplicate: false,
      event: eventRecord
    });
  } catch (err) {
    // 11. Durable failure -> 500 so Stripe retries; do not mark processed
    return res.status(500).json({
      ok: false,
      error: 'DURABLE_WRITE_FAILED',
      message: err && err.message ? err.message : 'unknown'
    });
  }
}

handler.config = { api: { bodyParser: false } };

module.exports = handler;
module.exports.verifyStripeSignature = verifyStripeSignature;
module.exports.signStripePayload = signStripePayload;
module.exports.setIdempotencyStore = setIdempotencyStore;
module.exports.createMemoryStore = createMemoryStore;
module.exports.OFFER_ID = OFFER_ID;
module.exports.SKU = SKU;
