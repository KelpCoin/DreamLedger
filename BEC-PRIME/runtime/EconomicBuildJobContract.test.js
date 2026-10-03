'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildJobFromSignal, artifactFromWorker, laneManifestInput, sha256 } = require('./EconomicBuildJobContract');

const signal = {
  signal_id: 'signal-real-contract-test',
  source: 'test-fixture-from-existing-signal-shape',
  source_ref: 'existing-source-reference',
  problem_text: 'A documented external problem requiring a bounded transformation.',
  estimated_value_nzd: 49,
  status: 'UNVERIFIED',
  raw_data: { demand_family: 'quote_comparison', substrate_required: 'supplier_quotes' }
};

test('signal becomes a provenance-carrying build job without economic claims', () => {
  const job = buildJobFromSignal(signal, {
    demand_family: 'quote_comparison',
    transformation_family: 'comparison_report',
    requested_output: 'structured comparison report'
  });
  assert.equal(job.signal_id, signal.signal_id);
  assert.equal(job.source_reference, signal.source_ref);
  assert.equal(job.status, 'READY');
  assert.match(job.input_hash, /^[a-f0-9]{64}$/);
  assert.equal(job.provenance.source_status, 'UNVERIFIED');
});

test('worker result becomes a hashed artifact with the same provenance', () => {
  const job = buildJobFromSignal(signal);
  const artifact = artifactFromWorker(job, '{"result":"bounded"}', 'model/test', 'runtime/777/local-build-artifacts/x.json');
  assert.equal(artifact.job_id, job.job_id);
  assert.equal(artifact.signal_id, job.signal_id);
  assert.equal(artifact.input_hash, job.input_hash);
  assert.equal(artifact.output_hash, sha256('{"result":"bounded"}'));
  assert.equal(artifact.revenue_claimed, false);
});

test('artifact becomes lane input and preserves the human/economic boundary', () => {
  const job = buildJobFromSignal(signal);
  const artifact = artifactFromWorker(job, 'artifact', 'model/test', 'artifact.json');
  const lane = laneManifestInput(job, artifact);
  assert.equal(lane.signal_id, signal.signal_id);
  assert.equal(lane.provenance.artifact_hash, artifact.output_hash);
  assert.equal(lane.commercial_boundary.external_action_required, true);
  assert.equal(lane.commercial_boundary.approval_required, true);
  assert.equal(lane.commercial_boundary.revenue_claim_allowed, false);
});

test('provenance mismatch is rejected', () => {
  const job = buildJobFromSignal(signal);
  const other = buildJobFromSignal({ ...signal, signal_id: 'different' });
  const artifact = artifactFromWorker(other, 'artifact', 'model/test', 'artifact.json');
  assert.throws(() => laneManifestInput(job, artifact), /PROVENANCE_MISMATCH/);
});
