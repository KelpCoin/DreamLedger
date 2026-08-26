'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.INVERSE_ECONOMIC_DATA_DIR || path.join(__dirname, '..', 'data', 'inverse-commerce');
const EVENT_FILE = path.join(DATA_DIR, 'economic-events.jsonl');

function ensureStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(EVENT_FILE)) fs.writeFileSync(EVENT_FILE, '', 'utf8');
}

function appendEvent(event) {
  ensureStore();
  const existing = fs.readFileSync(EVENT_FILE, 'utf8').split(/\r?\n/).filter(Boolean).some(line => {
    try { return JSON.parse(line).event_id === event.event_id; } catch { return false; }
  });
  if (existing) return { written: false, duplicate: true };
  fs.appendFileSync(EVENT_FILE, JSON.stringify(event) + '\n', 'utf8');
  return { written: true, duplicate: false };
}

function recordSettlement(event) {
  const session = event && event.data && event.data.object;
  if (!session || session.metadata?.sku !== 'INVERSE-SHOPPING-SOURCE-001') return { handled: false };
  const paymentId = session.payment_intent || session.id || null;
  const eventId = String(event.id || '');
  if (!eventId || !paymentId) return { handled: false, reason: 'missing_event_or_payment_id' };
  const record = {
    schema_version: 'economic-event-v1',
    event_id: eventId,
    event_type: 'PAYMENT_SETTLED',
    occurred_at: new Date((Number(event.created) || Math.floor(Date.now() / 1000)) * 1000).toISOString(),
    source: 'stripe',
    livemode: Boolean(event.livemode),
    payment_id: paymentId,
    checkout_session_id: session.id || null,
    sku: session.metadata?.sku || null,
    offer_id: session.metadata?.offer_id || null,
    product_id: session.metadata?.product_id || null,
    amount_total: session.amount_total ?? null,
    currency: session.currency || null,
    commercial_signal: 'PASS',
    fulfilment_status: 'AWAITING_WANTED_INTAKE'
  };
  return { handled: true, ...appendEvent(record), record };
}

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

module.exports = { DATA_DIR, EVENT_FILE, appendEvent, recordSettlement, sha256File };
