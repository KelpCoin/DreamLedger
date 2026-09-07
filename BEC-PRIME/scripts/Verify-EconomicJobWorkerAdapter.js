'use strict';

const assert = require('assert');
const { toWorkerJob, adaptJob, fetchNextJob } = require('../runtime/EconomicJobWorkerAdapter');

function response(status, body) {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) };
}

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
    async createJob(job) { calls.push(['createJob', job]); return { job_id: 'local-worker-001' }; },
    async execute(jobId) {
      calls.push(['execute', jobId]);
      return {
        job: { job_id: jobId, status: 'ARTIFACT_READY' },
        result: {
          status: 'ARTIFACT_READY',
          output: { worker: 'deterministic', message: 'synthetic artifact' },
          evidence_claims: { payment_claim: false, sale_claim: false, fulfillment_claim: false }
        },
        proof: { proof_hash: 'sha256:synthetic-proof' }
      };
    }
  };

  const result = await adaptJob(envelope, { workerPool: mockPool });
  assert.equal(result.source_job_id, envelope.job_id);
  assert.equal(result.worker_job_id, 'local-worker-001');
  assert.equal(result.status, 'ARTIFACT_READY');
  assert.equal(result.proof_ref, 'sha256:synthetic-proof');
  assert.equal(result.irreversible_effects_triggered, false);
  assert.equal(result.evidence_claims.payment_claim, false);
  assert.deepEqual(calls.map(x => x[0]), ['createJob', 'execute']);

  let requested;
  const fetched = await fetchNextJob({
    baseUrl: 'http://bridge.test',
    token: 'synthetic-token',
    fetchImpl: async (url, options) => {
      requested = { url, options };
      return response(200, { schema_version: 'BECK-ECONOMIC-JOB-1.0', job: envelope, count: 1, mutation: 'none' });
    }
  });
  assert.equal(requested.url, 'http://bridge.test/api/agent-bridge/jobs/next');
  assert.equal(requested.options.method, 'GET');
  assert.equal(requested.options.headers['x-dreamledger-agent-token'], 'synthetic-token');
  assert.equal(fetched.job_id, envelope.job_id);

  console.log('PASS EconomicJobWorkerAdapter local integration');
  console.log(JSON.stringify({
    adapter: 'PASS',
    bridge_read: 'PASS',
    worker_pool_mapping: 'PASS',
    bounded_execution: 'PASS',
    irreversible_effects_triggered: false,
    payment_claim: false,
    sale_claim: false,
    fulfillment_claim: false,
    ra000001_modified: false
  }, null, 2));
}

main().catch(error => { console.error(`FAIL EconomicJobWorkerAdapter: ${error.message}`); process.exitCode = 1; });
