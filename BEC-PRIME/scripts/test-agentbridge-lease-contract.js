'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { leaseNextJob } = require('../runtime/EconomicJobWorkerAdapter');

function response(status, body) {
  return {
    status,
    ok: status >= 200 && status < 300,
    async text() { return JSON.stringify(body); }
  };
}

function validLease(job) {
  return {
    rail_schema: 'BECK-BRIDGE-RAIL-1.1',
    envelope: {
      schema_version: 'BECK-BRIDGE-RAIL-1.1',
      job_id: 'JOB-EXIT-001',
      lease_id: 'LEASE-EXIT-001',
      lease_token: 'FENCE-1',
      worker_id: 'render-worker',
      objective: 'AUTONOMY_EXIT_TEST'
    },
    signature: 'test-signature',
    ...(job === undefined ? {} : { job })
  };
}

test('lease contract rejects a lease envelope with no job record', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return response(200, validLease());
  };

  await assert.rejects(
    leaseNextJob({
      baseUrl: 'http://bridge.test',
      token: 'test-token',
      workerId: 'render-worker',
      fetchImpl
    }),
    /Bridge rail lease missing job record for JOB-EXIT-001/
  );

  assert.equal(calls, 1, 'missing job must be rejected at the contract boundary');
});

test('lease contract accepts an envelope with an explicit job record', async () => {
  const fetchImpl = async () => response(200, validLease({
    id: 'JOB-EXIT-001',
    type: 'analysis',
    objective: 'AUTONOMY_EXIT_TEST',
    payload: { mission: 'AUTONOMY_EXIT_TEST' },
    silo: 'SILO_GENERAL'
  }));

  const lease = await leaseNextJob({
    baseUrl: 'http://bridge.test',
    token: 'test-token',
    workerId: 'render-worker',
    fetchImpl
  });

  assert.equal(lease.envelope.job_id, 'JOB-EXIT-001');
  assert.equal(lease.job.id, 'JOB-EXIT-001');
});

test('lease contract rejects an invalid rail schema before job handling', async () => {
  const fetchImpl = async () => response(200, {
    rail_schema: 'UNKNOWN',
    envelope: { schema_version: 'UNKNOWN', job_id: 'JOB-EXIT-002' },
    signature: 'test-signature'
  });

  await assert.rejects(
    leaseNextJob({
      baseUrl: 'http://bridge.test',
      token: 'test-token',
      workerId: 'render-worker',
      fetchImpl
    }),
    /Bridge rail returned invalid lease envelope/
  );
});
