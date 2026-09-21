'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const oracle = require('../routes/truthOracleCommerce');

function request(body) {
  const chunks = [];
  const req = {
    method: 'POST',
    url: '/api/truth-oracle/observe',
    async *[Symbol.asyncIterator]() { yield JSON.stringify(body); }
  };
  const res = {
    writableEnded: false,
    writeHead(status, headers) { this.status=status; this.headers=headers; },
    end(payload) { this.body=JSON.parse(payload); this.writableEnded=true; }
  };
  return { req, res };
}

test('observer rejects localhost before network access', async () => {
  const {req,res}=request({urls:['http://127.0.0.1/product']});
  await oracle.handle(req,res,'/api/truth-oracle/observe');
  assert.equal(res.status,200);
  assert.equal(res.body.observations.length,1);
  assert.equal(res.body.observations[0].ok,false);
  assert.match(res.body.observations[0].error,/Private|local/i);
});

test('observer rejects credential-bearing URLs', async () => {
  const {req,res}=request({urls:['https://user:pass@example.com/product']});
  await oracle.handle(req,res,'/api/truth-oracle/observe');
  assert.equal(res.status,200);
  assert.equal(res.body.observations[0].ok,false);
  assert.match(res.body.observations[0].error,/credentials/i);
});

test('observer labels the comparison as observed, not verified', async () => {
  const {req,res}=request({urls:[]});
  await oracle.handle(req,res,'/api/truth-oracle/observe');
  assert.equal(res.status,400);
  assert.match(res.body.error,/at least one/i);
});
