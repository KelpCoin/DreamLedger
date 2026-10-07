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


test('Stripe webhook is mounted before generic GET-only rejection', () => {
  assert.match(source, /const commercialCell=require\('\.\.\/BEC-PRIME\/routes\/commercialCell'\);/);
  assert.match(source, /p\.startsWith\('\/api\/commercial\/'\) \|\| p==='\/api\/webhooks\/stripe'/);
  assert.match(source, /commercialCell\.handle\(req,res,p\)/);
});

test('Toll manifest is handled explicitly at the storefront boundary', () => {
  assert.match(source, /p==='\/api\/toll\/v1\/manifest'/);
  assert.match(source, /tollRoad\.publicManifest\(\)/);
});
