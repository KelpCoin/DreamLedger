'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const guard = require('./heldCheckoutRouteGuard');

test('legacy Commander diagnostic buy routes fail closed with a visible disabled control', () => {
  for (const pathname of guard.HELD_ROUTE_PATHS) {
    const response = guard.responseFor('GET', pathname);
    assert.ok(response, pathname + ' must be intercepted');
    assert.equal(response.status, 200);
    assert.equal(response.headers['X-DreamLedger-Commerce-State'], 'HELD');
    assert.match(response.body, /Offer currently held/);
    assert.match(response.body, /<button[^>]+disabled/);
    assert.doesNotMatch(response.body, /https:\/\/(?:buy|checkout)\.stripe\.com\//i);
  }
});

test('unknown buy routes and non-GET methods are not silently rewritten', () => {
  assert.equal(guard.responseFor('GET', '/buy/OTHER-PRODUCT'), null);
  assert.equal(guard.responseFor('POST', '/buy/COMMANDER-DECK-DIAGNOSTIC-001'), null);
});

test('BECK installs the held-route guard before delegating to legacy handlers', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'start.js'), 'utf8');
  assert.match(source, /require\('\.\/runtime\/heldCheckoutRouteGuard'\)/);
  assert.match(source, /heldCheckoutRouteGuard\.handle\(req,res,requestPath\)\)return;/);
});
