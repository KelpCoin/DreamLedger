'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { normalizeClaimed } = require('./BridgeRail');

test('normalizes direct RPC row', () => {
  assert.equal(normalizeClaimed({ id:'job-1', lease_token:'t' }).id, 'job-1');
});

test('normalizes PostgREST array RPC response', () => {
  assert.equal(normalizeClaimed([{ id:'job-2', lease_token:'t' }]).id, 'job-2');
});

test('normalizes wrapped RPC result', () => {
  assert.equal(normalizeClaimed({ result:[{ id:'job-3', lease_token:'t' }] }).id, 'job-3');
});

test('normalizes named RPC result', () => {
  assert.equal(normalizeClaimed({ claim_job:{ id:'job-4', lease_token:'t' } }).id, 'job-4');
});
