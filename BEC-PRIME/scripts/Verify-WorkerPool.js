'use strict';

const fs = require('fs');
const path = require('path');
const { canonical, hash, listJobs, loadJob } = require('../runtime/worker-pool');

const ROOT = path.join(__dirname, '..');
const RESULT_DIR = path.resolve(process.env.BEC_JOB_QUEUE_DIR || path.join(ROOT, 'data', 'jobs'), 'results');
const PROOF_DIR = path.resolve(process.env.BEC_PROOF_DIR || path.join(ROOT, 'data', 'proofs'));

function read(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function assert(condition, message) { if (!condition) throw new Error(message); }

const jobs = listJobs();
let checked = 0;
for (const job of jobs) {
  if (job.status !== 'ARTIFACT_READY') continue;
  const resultFile = path.join(RESULT_DIR, `${job.job_id}.json`);
  const proofFile = path.join(PROOF_DIR, `${job.job_id}.json`);
  assert(fs.existsSync(resultFile), `Missing result for ${job.job_id}`);
  assert(fs.existsSync(proofFile), `Missing proof for ${job.job_id}`);
  const result = read(resultFile);
  const proof = read(proofFile);
  assert(result.job_id === job.job_id, `Result job mismatch: ${job.job_id}`);
  assert(result.evidence_claims.payment_claim === false, `Payment claim escaped worker gate: ${job.job_id}`);
  assert(result.evidence_claims.sale_claim === false, `Sale claim escaped worker gate: ${job.job_id}`);
  assert(result.evidence_claims.fulfillment_claim === false, `Fulfillment claim escaped worker gate: ${job.job_id}`);
  assert(result.public_action_allowed === false, `Public action escaped worker gate: ${job.job_id}`);
  assert(proof.approval_required === true, `Approval gate missing: ${job.job_id}`);
  assert(proof.public_action_allowed === false, `Proof allows public action: ${job.job_id}`);
  const resultBody = { ...result };
  delete resultBody.result_hash;
  assert(`sha256:${hash(resultBody)}` === result.result_hash, `Result hash mismatch: ${job.job_id}`);
  const proofBody = { ...proof };
  delete proofBody.proof_hash;
  assert(`sha256:${hash(proofBody)}` === proof.proof_hash, `Proof hash mismatch: ${job.job_id}`);
  checked += 1;
}

const report = {
  schema_version: 'BEC-WORKER-VERIFY-1.0',
  status: 'PASS',
  checked_jobs: checked,
  checked_at: new Date().toISOString(),
  queue_root: path.relative(ROOT, path.dirname(RESULT_DIR))
};
console.log(JSON.stringify(report, null, 2));
