'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');

process.env.SUPABASE_URL = 'https://supabase.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key';
process.env.SUPABASE_ANON_KEY = 'anon-test-key';
const { handle } = require('../routes/b2b-marketplace');

function response() {
  return {
    statusCode: 0, headers: {}, body: '',
    get writableEnded() { return this.ended === true; },
    writeHead(status, headers) { this.statusCode = status; this.headers = headers; },
    end(value = '') { this.body = String(value); this.ended = true; }
  };
}
function request(method, url, body = null, headers = {}) {
  const req = Readable.from(body === null ? [] : [JSON.stringify(body)]);
  req.method = method;
  req.url = url;
  req.headers = headers;
  return req;
}
const parse = res => JSON.parse(res.body);

test('B2B writes require a Supabase bearer session', async () => {
  const oldFetch = global.fetch;
  let called = false;
  global.fetch = async () => { called = true; throw new Error('must not call'); };
  try {
    const res = response();
    await handle(request('POST', '/api/b2b/rfqs', { title: 'RFQ', description: 'Need parts' }), res, '/api/b2b/rfqs');
    assert.equal(res.statusCode, 401);
    assert.equal(parse(res).code, 'AUTH_REQUIRED');
    assert.equal(called, false);
  } finally { global.fetch = oldFetch; }
});

test('B2B database outage fails closed and does not claim persistence', async () => {
  const oldFetch = global.fetch;
  global.fetch = async () => { throw new Error('ECONNREFUSED'); };
  try {
    const res = response();
    await handle(request('GET', '/api/b2b/search?q=bolt'), res, '/api/b2b/search');
    assert.equal(res.statusCode, 503);
    assert.equal(parse(res).code, 'B2B_DATA_UNAVAILABLE');
    assert.match(parse(res).error, /no transaction was recorded/i);
  } finally { global.fetch = oldFetch; }
});

test('RFQ creation requires idempotency and writes through the database API', async () => {
  const oldFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith('/auth/v1/user')) {
      return new Response(JSON.stringify({ id: '00000000-0000-4000-8000-000000000001', email: 'buyer@example.com', email_confirmed_at: '2026-01-01T00:00:00Z' }), { status: 200 });
    }
    if (String(url).includes('/rest/v1/marketplace_b2b_rfqs')) {
      const payload = JSON.parse(options.body);
      return new Response(JSON.stringify([{ id: '00000000-0000-4000-8000-000000000002', ...payload, created_at: '2026-10-10T00:00:00Z' }]), { status: 201 });
    }
    throw new Error('Unexpected URL ' + url);
  };
  try {
    const noKey = response();
    await handle(request('POST', '/api/b2b/rfqs', { title: 'Copper', description: 'Need copper sheet' }, { authorization: 'Bearer user-token' }), noKey, '/api/b2b/rfqs');
    assert.equal(noKey.statusCode, 422);
    assert.equal(calls.length, 1, 'only auth check should run before rejecting missing idempotency key');

    const res = response();
    await handle(request('POST', '/api/b2b/rfqs', { title: 'Copper', description: 'Need copper sheet', budget_nzd: 25 }, { authorization: 'Bearer user-token', 'idempotency-key': 'test-rfq-1' }), res, '/api/b2b/rfqs');
    assert.equal(res.statusCode, 201);
    assert.equal(parse(res).commercial_truth, 'RFQ_RECORDED_NOT_ORDER_OR_REVENUE');
    assert.equal(parse(res).item.budget_nzd, 25);
    assert.ok(calls.some(x => x.url.includes('/rest/v1/marketplace_b2b_rfqs')));
  } finally { global.fetch = oldFetch; }
});

test('supplier cannot read competing offers on another buyer RFQ', async () => {
  const oldFetch = global.fetch;
  global.fetch = async url => {
    if (String(url).endsWith('/auth/v1/user')) return new Response(JSON.stringify({ id: '00000000-0000-4000-8000-000000000003', email: 'supplier@example.com', email_confirmed_at: '2026-01-01T00:00:00Z' }), { status: 200 });
    if (String(url).includes('/rest/v1/marketplace_b2b_rfqs')) return new Response(JSON.stringify([{ id: 'rfq', buyer_user_id: '00000000-0000-4000-8000-000000000004', status: 'open' }]), { status: 200 });
    if (String(url).includes('/rest/v1/marketplace_b2b_offers')) return new Response(JSON.stringify([{ id: 'offer', supplier_user_id: '00000000-0000-4000-8000-000000000005', amount_minor: 1000 }]), { status: 200 });
    throw new Error('Unexpected URL ' + url);
  };
  try {
    const res = response();
    await handle(request('GET', '/api/b2b/rfqs/rfq/offers', null, { authorization: 'Bearer user-token' }), res, '/api/b2b/rfqs/rfq/offers');
    assert.equal(res.statusCode, 403);
  } finally { global.fetch = oldFetch; }
});
