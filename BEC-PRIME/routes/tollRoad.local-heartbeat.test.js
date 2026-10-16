'use strict';

const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const test = require('node:test');

const TOKEN = 'test-only-local-heartbeat-token-2026';
process.env.LOCAL_HEARTBEAT_TOKEN = TOKEN;
const { handle, localHeartbeatSnapshot } = require('./tollRoad');

function makeRequest({ method='GET', headers={}, body=null, url='/api/toll/v1/local-heartbeat' } = {}) {
  const req = Readable.from(body == null ? [] : [JSON.stringify(body)]);
  req.method = method;
  req.headers = headers;
  req.url = url;
  return req;
}

function makeResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    writableEnded: false,
    writeHead(status, headers) { this.statusCode = status; this.headers = headers || {}; },
    end(body='') { this.body = String(body); this.writableEnded = true; }
  };
}

async function request(options) {
  const req = makeRequest(options);
  const res = makeResponse();
  const handled = await handle(req, res, '/api/toll/v1/local-heartbeat');
  assert.equal(handled, true, 'heartbeat route should handle request');
  return { status: res.statusCode, headers: res.headers, body: JSON.parse(res.body || '{}') };
}

test('local BECK heartbeat is authenticated, bounded, replay-resistant, and never economic proof', async () => {
  const previousToken = process.env.LOCAL_HEARTBEAT_TOKEN;
  try {
    process.env.LOCAL_HEARTBEAT_TOKEN = '';
    assert.equal(localHeartbeatSnapshot().status, 'NOT_CONFIGURED');

    process.env.LOCAL_HEARTBEAT_TOKEN = TOKEN;
    assert.equal((await request({ method: 'POST', body: { ts: new Date().toISOString(), lm_studio: true } })).status, 401);
    assert.equal((await request({ method: 'POST', headers: { authorization: 'Bearer wrong-token' }, body: { ts: new Date().toISOString(), lm_studio: true } })).status, 401);

    const invalid = await request({
      method: 'POST',
      headers: { authorization: 'Bearer ' + TOKEN },
      body: { ts: 'not-a-date', lm_studio: true }
    });
    assert.equal(invalid.status, 400);

    const ts = new Date().toISOString();
    const validBody = {
      ts,
      lm_studio: true,
      tri_llm: true,
      capacity: 'available',
      models: ['scout-model', 'critic-model', 'vision-ocr']
    };
    const accepted = await request({
      method: 'POST',
      headers: { authorization: 'Bearer ' + TOKEN },
      body: validBody
    });
    assert.equal(accepted.status, 200);
    assert.equal(accepted.body.status, 'ACCEPTED');
    assert.equal(accepted.body.ttl_seconds, 300);
    assert.equal(accepted.body.economic_truth_unchanged, true);
    assert.equal(accepted.body.public_posts, false);
    assert.equal(accepted.body.payments_created, false);

    const status = await request({ method: 'GET' });
    assert.equal(status.status, 200);
    assert.equal(status.body.status, 'ONLINE');
    assert.equal(status.body.online, true);
    assert.equal(status.body.tri_llm, true);
    assert.equal(status.body.loaded_model_count, 3);
    assert.equal(status.body.ttl_seconds, 300);

    const replay = await request({
      method: 'POST',
      headers: { authorization: 'Bearer ' + TOKEN },
      body: validBody
    });
    assert.equal(replay.status, 409);
    assert.equal(replay.body.error, 'heartbeat_timestamp_replayed_or_out_of_order');

    const stale = localHeartbeatSnapshot(Date.parse(accepted.body.received_at) + 300001);
    assert.equal(stale.status, 'OFFLINE_OR_STALE');
    assert.equal(stale.online, false);
    assert.match(stale.note, /does not distinguish powered-off hardware/);
  } finally {
    if (previousToken === undefined) delete process.env.LOCAL_HEARTBEAT_TOKEN;
    else process.env.LOCAL_HEARTBEAT_TOKEN = previousToken;
  }
});
