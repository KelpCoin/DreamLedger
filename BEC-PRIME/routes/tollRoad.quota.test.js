'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

process.env.DREAMLEDGER_TOLL_KEY_SECRET = 'test-only-secret';
process.env.STRIPE_SECRET_KEY = 'sk_test_unit_only';
process.env.DREAMLEDGER_TOLL_CANONICAL_WEBHOOK_READY = 'true';
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.DREAMLEDGER_AGENT_BRIDGE_TOKEN = 'test-bridge-token';
process.env.AGENT_BRIDGE_PROXY_URL = 'https://example.supabase.co/functions/v1/agent-bridge-proxy';

const { reserveTollCall, handle } = require('./tollRoad');
const Toll = require('../runtime/TollRoad');

function fakeResponse() {
  return {
    status: null,
    headers: {},
    body: null,
    writableEnded: false,
    writeHead(status, headers) { this.status = status; this.headers = headers || {}; },
    end(body) { this.body = body; this.writableEnded = true; }
  };
}
function request(headers = {}) {
  return { method: 'POST', headers, _tollParsedBody: { action: 'test' } };
}
const key = { key_id: 'KEY-TEST-1', reference: 'cs_test_ref', calls_remaining: 500 };

test('requires an idempotency key before reserving paid work', async () => {
  const originalFetch = global.fetch;
  let called = false;
  global.fetch = async () => { called = true; throw new Error('should not call'); };
  try {
    const res = fakeResponse();
    const stopped = await reserveTollCall(request(), res, '/api/toll/v1/bridge-events', 'bridge-events', key, { action: 'test' });
    assert.equal(stopped, true);
    assert.equal(res.status, 400);
    assert.equal(JSON.parse(res.body).error, 'idempotency_key_required');
    assert.equal(called, false);
  } finally { global.fetch = originalFetch; }
});

test('fails closed when the durable quota RPC is unavailable', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => { throw new Error('database unavailable'); };
  try {
    const res = fakeResponse();
    const stopped = await reserveTollCall(request({ 'idempotency-key': 'req-1' }), res, '/api/toll/v1/bridge-events', 'bridge-events', key, { action: 'test' });
    assert.equal(stopped, true);
    assert.equal(res.status, 503);
    assert.equal(JSON.parse(res.body).error, 'toll_meter_unavailable');
  } finally { global.fetch = originalFetch; }
});

test('blocks an exhausted entitlement before executing the route', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: true, text: async () => JSON.stringify({ status: 'EXHAUSTED', limit: 500, used: 500, remaining: 0 }) });
  try {
    const res = fakeResponse();
    const stopped = await reserveTollCall(request({ 'idempotency-key': 'req-2' }), res, '/api/toll/v1/bridge-events', 'bridge-events', key, { action: 'test' });
    assert.equal(stopped, true);
    assert.equal(res.status, 402);
    assert.equal(JSON.parse(res.body).error, 'quota_exhausted');
  } finally { global.fetch = originalFetch; }
});

test('reserves a unit durably before allowing paid work to continue', async () => {
  const originalFetch = global.fetch;
  let payload;
  global.fetch = async (_url, init) => {
    payload = JSON.parse(init.body);
    return { ok: true, text: async () => JSON.stringify({ status: 'RESERVED', event_id: 'TOLL-USAGE-KEY-TEST-1-a1', remaining: 499, used: 1, limit: 500 }) };
  };
  try {
    const req = request({ 'idempotency-key': 'req-3' });
    const res = fakeResponse();
    const stopped = await reserveTollCall(req, res, '/api/toll/v1/bridge-events', 'bridge-events', key, { action: 'test' });
    assert.equal(stopped, false);
    assert.equal(res._tollUsage.event_id, 'TOLL-USAGE-KEY-TEST-1-a1');
    assert.equal(req._tollParsedBody.action, 'test');
    assert.equal(payload.path, 'rpc/reserve_agent_toll_call');
    assert.equal(payload.body.p_key_id, key.key_id);
    assert.equal(payload.body.p_call_limit, 500);
  } finally { global.fetch = originalFetch; }
});

test('returns the stored result on a duplicate idempotent request', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: true, text: async () => JSON.stringify({ status: 'REPLAY', http_status: 200, response_body: { result: 'original' } }) });
  try {
    const res = fakeResponse();
    const stopped = await reserveTollCall(request({ 'idempotency-key': 'req-4' }), res, '/api/toll/v1/bridge-events', 'bridge-events', key, { action: 'test' });
    assert.equal(stopped, true);
    assert.equal(res.status, 200);
    assert.deepEqual(JSON.parse(res.body), { result: 'original' });
  } finally { global.fetch = originalFetch; }
});

test('checkout remains closed when the durable quota health RPC is not ready', async () => {
  const originalFetch = global.fetch;
  let stripeCheckoutAttempted = false;
  global.fetch = async (url) => {
    if (String(url).includes('checkout/sessions')) stripeCheckoutAttempted = true;
    return { ok: true, text: async () => JSON.stringify({ ready: false, status: 'NOT_READY' }) };
  };
  try {
    const res = fakeResponse();
    await handle({ method: 'GET', url: '/api/toll/v1/checkout/bridge-events', headers: {} }, res, '/api/toll/v1/checkout/bridge-events');
    assert.equal(res.status, 503);
    assert.equal(stripeCheckoutAttempted, false);
  } finally { global.fetch = originalFetch; }
});

test('redemption remains closed when the durable quota health RPC is unavailable', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => { throw new Error('proxy unavailable'); };
  try {
    const res = fakeResponse();
    await handle({ method: 'GET', url: '/api/toll/v1/redeem/bridge-events?session_id=cs_live_example', headers: {} }, res, '/api/toll/v1/redeem/bridge-events');
    assert.equal(res.status, 503);
    assert.match(JSON.parse(res.body).error, /quota enforcement/i);
  } finally { global.fetch = originalFetch; }
});

test('paid bridge-events calls enter the existing Agent Bridge event pipeline', async () => {
  const originalFetch = global.fetch;
  const seen = [];
  global.fetch = async (url, init = {}) => {
    const u = String(url);
    if (u.includes('/api/agent-bridge/events')) {
      const event = JSON.parse(init.body);
      seen.push({ kind: 'bridge-event', event });
      return { ok: true, status: 201, text: async () => JSON.stringify({ accepted: true, note_id: 'note-test-1', event }) };
    }
    const requestBody = JSON.parse(init.body || '{}');
    seen.push({ kind: 'rpc', path: requestBody.path, body: requestBody.body });
    if (requestBody.path === 'rpc/reserve_agent_toll_call') {
      return { ok: true, status: 200, text: async () => JSON.stringify({ status: 'RESERVED', event_id: 'TOLL-USAGE-KEY-TEST-INGEST-abc', remaining: 499, used: 1, limit: 500 }) };
    }
    if (requestBody.path === 'rpc/complete_agent_toll_call') {
      return { ok: true, status: 200, text: async () => JSON.stringify({ status: 'COMPLETED' }) };
    }
    return { ok: false, status: 404, text: async () => JSON.stringify({ error: 'unexpected route' }) };
  };
  try {
    const token = Toll.issueKey({ keyId: 'KEY-TEST-INGEST', tier: 'bridge-events', callsRemaining: 500 });
    const req = {
      method: 'POST',
      url: '/api/toll/v1/bridge-events',
      headers: { 'x-dreamledger-toll-key': token, 'idempotency-key': 'ingest-1' },
      _tollParsedBody: { event_type: 'CANDIDATE_FOUND', claim: 'Supplier demand signal', evidence: { source: 'test fixture' } }
    };
    const res = fakeResponse();
    await handle(req, res, '/api/toll/v1/bridge-events');
    assert.equal(res.status, 201);
    const result = JSON.parse(res.body);
    assert.equal(result.accepted, true);
    assert.equal(result.service, 'AGENT-BRIDGE-STARTER');
    const bridgeCall = seen.find(x => x.kind === 'bridge-event');
    assert.ok(bridgeCall);
    assert.equal(bridgeCall.event.agent, 'monetizer');
    assert.equal(bridgeCall.event.event_type, 'CANDIDATE_FOUND');
    assert.deepEqual(bridgeCall.event.suggested_next_agents, ['claude', 'grok', 'truth_oracle', 'gauntlet']);
    assert.ok(seen.some(x => x.kind === 'rpc' && x.path === 'rpc/reserve_agent_toll_call'));
    assert.ok(seen.some(x => x.kind === 'rpc' && x.path === 'rpc/complete_agent_toll_call'));
  } finally { global.fetch = originalFetch; }
});

test('paid bridge-event ingestion rejects economic-truth event types before quota reservation', async () => {
  const originalFetch = global.fetch;
  let called = false;
  global.fetch = async () => { called = true; throw new Error('should not call'); };
  try {
    const token = Toll.issueKey({ keyId: 'KEY-TEST-INGEST-2', tier: 'bridge-events', callsRemaining: 500 });
    const req = {
      method: 'POST',
      url: '/api/toll/v1/bridge-events',
      headers: { 'x-dreamledger-toll-key': token, 'idempotency-key': 'ingest-bad' },
      _tollParsedBody: { event_type: 'PAYMENT_DETECTED', claim: 'untrusted' }
    };
    const res = fakeResponse();
    await handle(req, res, '/api/toll/v1/bridge-events');
    assert.equal(res.status, 400);
    assert.equal(JSON.parse(res.body).error, 'unsupported_bridge_event_type');
    assert.equal(called, false);
  } finally { global.fetch = originalFetch; }
});

test('Agent Bridge proxy allowlist exposes only the required toll-meter RPC additions', () => {
  const proxyPath = path.join(__dirname, '../../supabase/functions/agent-bridge-proxy/index.ts');
  const proxy = fs.readFileSync(proxyPath, 'utf8');
  for (const name of ['reserve_agent_toll_call', 'complete_agent_toll_call', 'agent_toll_meter_health', 'get_agent_toll_entitlement', 'complete_agent_toll_fulfillment']) {
    assert.ok(proxy.includes(name), 'missing proxy RPC allowlist entry: ' + name);
  }
  assert.ok(proxy.includes('const allowedRpc=new Set('));
});

test('shared route pass rejects unpublished placeholder routes before quota reservation', async () => {
  const originalFetch = global.fetch;
  let called = false;
  global.fetch = async () => { called = true; throw new Error('should not call'); };
  try {
    const token = Toll.issueKey({ keyId: 'KEY-TEST-ALL', tier: 'all', callsRemaining: 5000 });
    const req = {
      method: 'POST',
      url: '/api/toll/v1/job-claim',
      headers: { 'x-dreamledger-toll-key': token, 'idempotency-key': 'job-claim-1' },
      _tollParsedBody: { job_id: 'fake' }
    };
    const res = fakeResponse();
    await handle(req, res, '/api/toll/v1/job-claim');
    assert.equal(res.status, 403);
    assert.equal(JSON.parse(res.body).error, 'toll_key_scope_denied');
    assert.equal(called, false);
  } finally { global.fetch = originalFetch; }
});

test('redemption requires the canonical paid entitlement and records fulfillment before returning the key', async () => {
  const originalFetch = global.fetch;
  const seen = [];
  global.fetch = async (url, init = {}) => {
    const u = String(url);
    if (u.includes('api.stripe.com/v1/checkout/sessions/')) {
      return { ok: true, status: 200, text: async () => JSON.stringify({
        id: 'cs_live_canonical_test', livemode: true, payment_status: 'paid',
        currency: 'nzd', amount_total: 500, created: Math.floor(Date.now()/1000),
        metadata: { toll_scope: 'bridge-events', toll_price_nzd: '5', sku_id: 'AGENT-BRIDGE-STARTER-500', sku: 'AGENT-BRIDGE-STARTER-500' }
      }) };
    }
    const requestBody = JSON.parse(init.body || '{}');
    seen.push({ path: requestBody.path, body: requestBody.body });
    if (requestBody.path === 'rpc/agent_toll_meter_health') return { ok: true, text: async () => JSON.stringify({ ready: true }) };
    if (requestBody.path === 'rpc/get_agent_toll_entitlement') return { ok: true, text: async () => JSON.stringify({
      status: 'READY', sku_id: 'AGENT-BRIDGE-STARTER-500', order_id: 'order-1',
      entitlement_id: 'entitlement-1', fulfillment_key: 'DL-AGENT-BRIDGE-STARTER-500-ABC123',
      fulfillment_request_id: 'fulfillment-1', entitlement_status: 'ready', fulfillment_status: 'queued'
    }) };
    if (requestBody.path === 'rpc/complete_agent_toll_fulfillment') return { ok: true, text: async () => JSON.stringify({ status: 'FULFILLED_UNVERIFIED', fulfillment_request_id: 'fulfillment-1' }) };
    return { ok: false, status: 404, text: async () => '{}' };
  };
  try {
    const res = fakeResponse();
    await handle({ method: 'GET', url: '/api/toll/v1/redeem/bridge-events?session_id=cs_live_canonical_test', headers: {} }, res, '/api/toll/v1/redeem/bridge-events');
    assert.equal(res.status, 200);
    const result = JSON.parse(res.body);
    assert.equal(result.status, 'ENTITLED');
    assert.equal(result.sku_id, 'AGENT-BRIDGE-STARTER-500');
    assert.ok(result.key);
    assert.ok(seen.some(x => x.path === 'rpc/get_agent_toll_entitlement'));
    const completion = seen.find(x => x.path === 'rpc/complete_agent_toll_fulfillment');
    assert.ok(completion);
    assert.equal(completion.body.p_session_id, 'cs_live_canonical_test');
    assert.match(completion.body.p_key_digest, /^[0-9a-f]{64}$/);
  } finally { global.fetch = originalFetch; }
});

test('redemption returns pending and never issues a key before canonical order/entitlement exists', async () => {
  const originalFetch = global.fetch;
  let completionCalled = false;
  global.fetch = async (url, init = {}) => {
    if (String(url).includes('api.stripe.com/v1/checkout/sessions/')) {
      return { ok: true, status: 200, text: async () => JSON.stringify({
        id: 'cs_live_pending_test', livemode: true, payment_status: 'paid',
        currency: 'nzd', amount_total: 500, created: Math.floor(Date.now()/1000),
        metadata: { toll_scope: 'bridge-events', toll_price_nzd: '5', sku_id: 'AGENT-BRIDGE-STARTER-500', sku: 'AGENT-BRIDGE-STARTER-500' }
      }) };
    }
    const requestBody = JSON.parse(init.body || '{}');
    if (requestBody.path === 'rpc/agent_toll_meter_health') return { ok: true, text: async () => JSON.stringify({ ready: true }) };
    if (requestBody.path === 'rpc/get_agent_toll_entitlement') return { ok: true, text: async () => JSON.stringify({ status: 'PENDING', reason: 'canonical_order_not_observed' }) };
    if (requestBody.path === 'rpc/complete_agent_toll_fulfillment') completionCalled = true;
    return { ok: true, text: async () => JSON.stringify({}) };
  };
  try {
    const res = fakeResponse();
    await handle({ method: 'GET', url: '/api/toll/v1/redeem/bridge-events?session_id=cs_live_pending_test', headers: {} }, res, '/api/toll/v1/redeem/bridge-events');
    assert.equal(res.status, 202);
    const result = JSON.parse(res.body);
    assert.equal(result.pending, true);
    assert.equal(result.status, 'PENDING_CANONICAL_ENTITLEMENT');
    assert.equal(result.key, undefined);
    assert.equal(completionCalled, false);
  } finally { global.fetch = originalFetch; }
});

test('toll migration seeds canonical SKUs and reuses existing tables rather than adding a ledger', () => {
  const migrationPath = path.join(__dirname, '../../supabase/migrations/20261010120000_agent_bridge_toll_quota.sql');
  const migration = fs.readFileSync(migrationPath, 'utf8');
  for (const sku of ['TOLL-PROBE-1','DECISION-CHECK-100','EVIDENCE-CHECK-100','AGENT-BRIDGE-STARTER-500','MICRO-EVENT-INGEST-200','ROUTE-PASS-30D-5000','TOLL-NEXUS-25']) {
    assert.ok(migration.includes(sku), 'missing canonical toll SKU seed: ' + sku);
  }
  for (const rpc of ['reserve_agent_toll_call','complete_agent_toll_call','get_agent_toll_entitlement','complete_agent_toll_fulfillment','agent_toll_meter_health']) {
    assert.ok(migration.includes('function public.' + rpc), 'missing toll RPC: ' + rpc);
  }
  assert.ok(migration.includes('insert into public.control_bridge_notes'));
  assert.ok(!/create\\s+table\\s+public\\.(agent_toll|toll_usage|toll_entitlement)/i.test(migration));
});
