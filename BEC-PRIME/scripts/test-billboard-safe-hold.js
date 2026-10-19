'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { handle } = require('../routes/billboard-v2');

function responseMock() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    writableEnded: false,
    writeHead(status, headers) {
      this.statusCode = status;
      this.headers = headers || {};
    },
    end(body) {
      this.body = String(body || '');
      this.writableEnded = true;
    }
  };
}

test('direct Billboard submit API returns held before parsing input or creating a Stripe session', async () => {
  const originalFlag = process.env.BILLBOARD_CHECKOUT_ENABLED;
  const originalFetch = global.fetch;
  let fetchCalls = 0;
  delete process.env.BILLBOARD_CHECKOUT_ENABLED;
  global.fetch = async () => {
    fetchCalls += 1;
    throw new Error('test failure: fetch must not be called from safe hold');
  };

  try {
    const req = { method: 'POST', headers: {} };
    const res = responseMock();
    const handled = await handle(req, res, '/api/billboard/submit/GLOBAL');
    assert.equal(handled, undefined);
    assert.equal(res.statusCode, 503);
    assert.equal(JSON.parse(res.body).error, 'CHECKOUT_HELD');
    assert.equal(fetchCalls, 0);
  } finally {
    global.fetch = originalFetch;
    if (originalFlag === undefined) delete process.env.BILLBOARD_CHECKOUT_ENABLED;
    else process.env.BILLBOARD_CHECKOUT_ENABLED = originalFlag;
  }
});

console.log('BILLBOARD_DIRECT_ADAPTER_SAFE_HOLD=PASS');
