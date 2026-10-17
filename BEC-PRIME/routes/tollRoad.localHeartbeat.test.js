'use strict';

const { EventEmitter } = require('node:events');
const { after, test } = require('node:test');
const assert = require('node:assert/strict');
const { handle } = require('./tollRoad');

const ROUTE = '/api/toll/v1/local-heartbeat';
const ORIGINAL_TOKEN = process.env.LOCAL_HEARTBEAT_TOKEN;

after(() => {
  if (ORIGINAL_TOKEN === undefined) delete process.env.LOCAL_HEARTBEAT_TOKEN;
  else process.env.LOCAL_HEARTBEAT_TOKEN = ORIGINAL_TOKEN;
});

async function postHeartbeat(body, token) {
  const req = new EventEmitter();
  req.method = 'POST';
  req.url = ROUTE;
  req.headers = token ? { authorization: 'Bearer ' + token } : {};

  let complete;
  const response = new Promise(resolve => { complete = resolve; });
  const res = {
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = headers;
      return this;
    },
    end(raw) {
      let parsed;
      try { parsed = JSON.parse(String(raw || '{}')); }
      catch { parsed = raw; }
      complete({ statusCode: this.statusCode, headers: this.headers, body: parsed });
    }
  };

  const handling = handle(req, res, ROUTE);
  req.emit('data', Buffer.from(JSON.stringify(body)));
  req.emit('end');
  await handling;
  return response;
}

function validPayload(overrides = {}) {
  return {
    ts: new Date().toISOString(),
    lm_studio: true,
    tri_llm: false,
    capacity: 'available',
    host: 'local-agent',
    models: [],
    ...overrides
  };
}

test('fails closed when LOCAL_HEARTBEAT_TOKEN is not configured', async () => {
  delete process.env.LOCAL_HEARTBEAT_TOKEN;
  const result = await postHeartbeat({}, undefined);
  assert.equal(result.statusCode, 503);
  assert.equal(result.body.error, 'local_heartbeat_not_configured');
});

test('rejects a wrong bearer token', async () => {
  process.env.LOCAL_HEARTBEAT_TOKEN = 'test-local-heartbeat-token';
  const result = await postHeartbeat({}, 'wrong-token');
  assert.equal(result.statusCode, 401);
  assert.equal(result.body.error, 'invalid_local_heartbeat_token');
});

test('rejects non-object JSON bodies without a server error', async () => {
  process.env.LOCAL_HEARTBEAT_TOKEN = 'test-local-heartbeat-token';
  const result = await postHeartbeat(null, 'test-local-heartbeat-token');
  assert.equal(result.statusCode, 400);
  assert.equal(result.body.error, 'json_object_required');
});

test('rejects stale timestamps', async () => {
  process.env.LOCAL_HEARTBEAT_TOKEN = 'test-local-heartbeat-token';
  const result = await postHeartbeat(validPayload({
    ts: new Date(Date.now() - 11 * 60 * 1000).toISOString()
  }), 'test-local-heartbeat-token');
  assert.equal(result.statusCode, 400);
  assert.equal(result.body.error, 'heartbeat_timestamp_out_of_window');
});

test('requires the LM Studio readiness boolean', async () => {
  process.env.LOCAL_HEARTBEAT_TOKEN = 'test-local-heartbeat-token';
  const result = await postHeartbeat({ ts: new Date().toISOString() }, 'test-local-heartbeat-token');
  assert.equal(result.statusCode, 400);
  assert.equal(result.body.error, 'lm_studio_boolean_required');
});

test('accepts a valid heartbeat, sanitizes fields, and rate-limits rapid repeats', async () => {
  process.env.LOCAL_HEARTBEAT_TOKEN = 'test-local-heartbeat-token';
  const accepted = await postHeartbeat(validPayload({
    host: 'Windows workstation!',
    tri_llm: true,
    models: ['Model One', 'Model/Two']
  }), 'test-local-heartbeat-token');

  assert.equal(accepted.statusCode, 200);
  assert.equal(accepted.body.status, 'ACCEPTED');
  assert.equal(accepted.body.ttl_seconds, 300);
  assert.equal(accepted.body.local_heartbeat.host, 'Windowsworkstation');
  assert.deepEqual(accepted.body.local_heartbeat.models, ['ModelOne', 'Model/Two']);
  assert.equal(accepted.body.local_heartbeat.tri_llm, true);
  assert.match(accepted.body.local_heartbeat.proves_only, /not independent verification/i);

  const repeated = await postHeartbeat(validPayload(), 'test-local-heartbeat-token');
  assert.equal(repeated.statusCode, 429);
  assert.equal(repeated.body.error, 'heartbeat_rate_limited');
});
