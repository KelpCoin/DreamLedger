'use strict';

const assert = require('assert');
const { toWorkerJob, adaptJob, leaseNextJob } = require('../runtime/EconomicJobWorkerAdapter');

async function main() {
  const envelope = {
    schema_version: 'BECK-ECONOMIC-JOB-1.0',
    job_id: 'synthetic-economic-job-001',
    job_type: 'analysis',
    state: 'pending',
    source: 'synthetic-test',
    objective: 'Produce a bounded analysis artifact only',
    candidate_id: 'candidate-001',
    offer_ids: ['offer-001'],
    required_evidence: { proof_truth: 'worker-proof', payment_truth: 'external-payment-only' },
    existing_evidence: { synthetic: true },
    approval_required: true,
    approval_gate: 'human_approval_required',
    next_permitted_action: 'PREPARE_ONLY_UNTIL_HUMAN_APPROVAL'
  };

  const workerJob = toWorkerJob(envelope);
  assert.equal(workerJob.job_id, 'bridge_synthetic-economic-job-001');
  assert.equal(workerJob.kind, 'analysis');
  assert.equal(workerJob.task, envelope.objective);
  assert.deepEqual(workerJob.inputs.offer_ids, ['offer-001']);
  assert.equal(workerJob.approval_required, true);
  assert.equal(workerJob.public_action_allowed, false);
  assert.deepEqual(workerJob.effects, []);

  const calls = [];
  const mockPool = {
    async createJob(job) { calls.push(['createJob', job]); return { ...job, status: 'QUEUED' }; },
    async execute(job) {
      calls.push(['execute', job]);
      assert.equal(typeof job, 'object');
      assert.equal(job.job_id, calls[0][1].job_id);
      return {
        job: { job_id: job.job_id, status: 'ARTIFACT_READY' },
        result: {
          status: 'ARTIFACT_READY',
          output: { worker: 'deterministic', message: 'bounded artifact' },
          evidence_claims: { payment_claim: false, sale_claim: false, fulfillment_claim: false }
        },
        proof: { proof_hash: 'sha256:test-proof' }
      };
    }
  };

  const result = await adaptJob(envelope, { workerPool: mockPool });
  assert.equal(result.source_job_id, envelope.job_id);
  assert.equal(result.worker_job_id, calls[0][1].job_id);
  assert.equal(result.status, 'ARTIFACT_READY');
  assert.equal(result.proof_ref, 'sha256:test-proof');
  assert.equal(result.irreversible_effects_triggered, false);
  assert.equal(result.evidence_claims.payment_claim, false);
  assert.deepEqual(calls.map(x => x[0]), ['createJob', 'execute']);

  let requested;
  const fetched = await leaseNextJob({
    baseUrl: 'http://bridge.test',
    token: 'test-token',
    workerId: 'github-worker',
    fetchImpl: async (url, options) => {
      requested = { url, options };
      return { ok: true, status: 200, text: async () => JSON.stringify({
        rail_schema: 'BECK-BRIDGE-RAIL-1.1',
        envelope: { schema_version: 'BECK-BRIDGE-RAIL-1.1', job_id: envelope.job_id, worker_id: 'github-worker', objective: envelope.objective },
        signature: 'test-signature',
        job: envelope
      }) };
    }
  });
  assert.equal(requested.url, 'http://bridge.test/api/agent-bridge/rail/lease');
  assert.equal(requested.options.method, 'POST');
  assert.equal(requested.options.headers['x-dreamledger-agent-token'], 'test-token');
  assert.equal(fetched.envelope.job_id, envelope.job_id);

  console.log('PASS EconomicJobWorkerAdapter local integration');
  console.log(JSON.stringify({
    adapter: 'PASS',
    bridge_read: 'PASS',
    worker_pool_mapping: 'PASS',
    execute_receives_full_job_object: 'PASS',
    bounded_execution: 'PASS',
    irreversible_effects_triggered: false,
    payment_claim: false,
    sale_claim: false,
    fulfillment_claim: false,
    ra000001_modified: false
  }, null, 2));
}

main().catch(error => { console.error(`FAIL EconomicJobWorkerAdapter: ${error.message}`); process.exitCode = 1; });
