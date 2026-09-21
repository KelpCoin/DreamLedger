'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('fs');

const source = fs.readFileSync(new URL('./server.js', import.meta.url), 'utf8');

test('Truth Oracle public aliases are served by the storefront', () => {
  assert.match(source, /'\/truth-oracle':'truth-oracle\.html'/);
  assert.match(source, /'\/truth-oracle\.html':'truth-oracle\.html'/);
});

test('Truth Oracle API is handled locally before generic engine proxying', () => {
  assert.match(source, /if\(p\.startsWith\('\/api\/truth-oracle'\)/);
  assert.match(source, /truthOracleCommerce\.handle\(req,res,p\)/);
});
