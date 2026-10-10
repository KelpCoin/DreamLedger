'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');

test('Truth Oracle public aliases are served by the storefront', () => {
  assert.ok(source.includes("'\/truth-oracle':'truth-oracle.html'"));
  assert.ok(source.includes("'\/truth-oracle.html':'truth-oracle.html'"));
});

test('Truth Oracle API is handled locally before generic engine proxying', () => {
  assert.ok(source.includes("p.startsWith('/api/truth-oracle')"));
  assert.ok(source.includes('truthOracleCommerce.handle(req,res,p)'));
});

test('Stripe webhook is mounted before generic GET-only rejection', () => {
  assert.ok(source.includes("const commercialCell=require('../BEC-PRIME/routes/commercialCell');"));
  assert.ok(source.includes("p.startsWith('/api/commercial/') || p==='/api/webhooks/stripe'"));
  assert.ok(source.includes('commercialCell.handle(req,res,p)'));
});

test('Toll Road manifest reaches the canonical Toll Road handler', () => {
  assert.ok(source.includes("if(p.startsWith('/api/toll/v1/'))"));
  assert.ok(source.includes('tollRoad.handle(req,res,p)'));
  assert.ok(!source.includes("schema:'dreamledger/public-resources/v1'"));
});
