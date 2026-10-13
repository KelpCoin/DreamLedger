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

const { restPath } = require('./BridgeRail');

test('builds PostgREST query with exactly one separator and encoded values', () => {
  const path = restPath('jobs', { worker_id:'eq.render-worker', status:'eq.leased', leased_until:'gt.2026-09-25T08:00:00.000Z', limit:1 });
  assert.match(path, /^jobs\?/);
  assert.equal((path.match(/\?/g) || []).length, 1);
  assert.equal(path.includes('%3F'), false);
  assert.match(path, /worker_id=eq\.render-worker/);
  assert.match(path, /limit=1/);
});

test('normalizes empty wrapped RPC claims as idle rather than phantom leases', () => {
  assert.equal(normalizeClaimed(null), null);
  assert.equal(normalizeClaimed([]), null);
  assert.equal(normalizeClaimed({ claim_job: null }), null);
  assert.equal(normalizeClaimed({ data: null }), null);
  assert.equal(normalizeClaimed({ result: [] }), null);
  assert.equal(normalizeClaimed({ status: 'NO_JOB' }), null);
});

test('does not disguise a malformed non-empty claim as idle', () => {
  assert.deepEqual(normalizeClaimed({ lease_token: 'present-but-no-id' }), { lease_token: 'present-but-no-id' });
});

test('normalizes a Postgres null composite claim row as idle', () => {
  assert.equal(normalizeClaimed({ id:null, type:null, status:null, payload:null, lease_token:null }), null);
});
