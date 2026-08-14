'use strict';

const fs = require('fs');
const path = require('path');
const worker = require('../runtime/worker-pool');

const job = worker.createJob({
  kind: 'analysis',
  silo: 'mtg',
  task: 'Worker pool smoke test. Return a deterministic acknowledgement. Do not claim payment.',
  inputs: { smoke: true },
  effects: [],
  worker_preference: 'auto'
});

(async () => {
  const result = await worker.runNext();
  if (result.status === 'FAILED') throw new Error(result.error || 'Worker failed');
  if (result.status === 'IDLE') throw new Error('Worker unexpectedly idle after enqueue');
  if (result.result.evidence_claims.payment_claim !== false) throw new Error('Payment claim escaped gate');
  if (result.result.public_action_allowed !== false) throw new Error('Public action escaped gate');
  const proofFile = path.join(__dirname, '..', 'data', 'proofs', `${job.job_id}.json`);
  if (!fs.existsSync(proofFile)) throw new Error('Proof artifact missing');
  console.log(JSON.stringify({ status: 'PASS', job_id: job.job_id, proof: proofFile }, null, 2));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
