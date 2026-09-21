'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');

test('Truth Oracle public aliases are served by the storefront', () => {
  assert.match(source, /'\/truth-oracle':'truth-oracle\.html'/);
  assert.match(source, /'\/truth-oracle\.html':'truth-oracle\.html'/);
});

test('Truth Oracle API is handled locally before generic engine proxying', () => {
  assert.match(source, /if\(p\.startsWith\('\/api\/truth-oracle'\)/);
  assert.match(source, /truthOracleCommerce\.handle\(req,res,p\)/);
});
