'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');

process.env.SUPABASE_URL = 'https://db.example.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
const intake = require('../BEC-PRIME/routes/publicRfqIntake');

function request(body, method = 'POST') {
  const req = Readable.from([Buffer.from(JSON.stringify(body))]);
  req.method = method;
  req.headers = { 'content-type': 'application/json' };
  return req;
}
function response() {
  return {
    headers: {},
    statusCode: 200,
    setHeader(k, v) { this.headers[k] = v; },
    end(v) { this.body = JSON.parse(v); this.writableEnded = true; }
  };
}
function valid() {
  return {
    company: 'Example Ltd',
    email: 'buyer@example.co.nz',
    category: 'IT & hardware',
    title: 'Need 20 rugged tablets',
    details: 'Need twenty rugged tablets with warranty and Auckland delivery within 30 days.',
    budget: 'Under NZD 15000',
    region: 'Auckland',
    contact_consent: true,
    idempotency_key: 'rfq-test-unique-0001',
    website: ''
  };
}

test('persists a consented RFQ privately and returns a reference', async t => {
  const oldFetch = global.fetch;
  let sent;
  global.fetch = async (url, options) => {
    sent = { url, options, row: JSON.parse(options.body) };
    return { ok: true, text: async () => JSON.stringify([{ id: 'rfq-123' }]) };
  };
  t.after(() => { global.fetch = oldFetch; });
  const res = response();
  const handled = await intake.handle(request(valid()), res, '/api/marketplace/intake');
  assert.equal(handled, true);
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.reference, 'rfq-123');
  assert.equal(sent.row.status, 'received');
  assert.equal(sent.row.contact_consent, true);
  assert.match(sent.url, /on_conflict=idempotency_key/);
  assert.equal(sent.row.contact_email, 'buyer@example.co.nz');
  assert.equal(res.body.next.includes('not guaranteed'), true);
});

test('rejects submissions without explicit contact consent', async t => {
  const oldFetch = global.fetch;
  global.fetch = async () => { throw new Error('must not call storage'); };
  t.after(() => { global.fetch = oldFetch; });
  const input = valid();
  input.contact_consent = false;
  const res = response();
  await intake.handle(request(input), res, '/api/marketplace/intake');
  assert.equal(res.statusCode, 422);
});

test('honeypot is absorbed without persistence', async t => {
  const oldFetch = global.fetch;
  global.fetch = async () => { throw new Error('honeypot must not persist'); };
  t.after(() => { global.fetch = oldFetch; });
  const input = valid();
  input.website = 'bot-filled-this';
  const res = response();
  await intake.handle(request(input), res, '/api/marketplace/intake');
  assert.equal(res.statusCode, 202);
  assert.equal(res.body.ok, true);
});

test('non-target path is not consumed', async () => {
  const res = response();
  const handled = await intake.handle(request(valid()), res, '/api/other');
  assert.equal(handled, false);
});
