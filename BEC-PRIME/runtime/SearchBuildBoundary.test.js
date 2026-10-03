'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { toBuildJob, artifactFor, preparedBoundary } = require('./SearchBuildBoundary');

test('preserves real demand provenance in build job', () => {
  const job = toBuildJob({
    candidate_id: 'BUYER-SIGNAL-2026-09-26-001',
    url: 'https://www.reddit.com/r/mtg/comments/1wqqbxl/new_precon_upgrade_help/',
    demand_family: 'commander_upgrade_help',
    requested_output: 'decision_artifact',
    substrate_reference: 'COMMANDER-DIAGNOSTIC-001'
  });
  assert.equal(job.signal_id, 'BUYER-SIGNAL-2026-09-26-001');
  assert.equal(job.source_reference, 'https://www.reddit.com/r/mtg/comments/1wqqbxl/new_precon_upgrade_help/');
  assert.match(job.input_hash, /^sha256:[a-f0-9]{64}$/);
});

test('turns a worker result into a non-authoritative artifact', () => {
  const job = toBuildJob({
    candidate_id: 'BUYER-SIGNAL-2026-09-26-001',
    url: 'https://example.invalid',
    substrate_reference: 'COMMANDER-DIAGNOSTIC-001'
  });
  const artifact = artifactFor(job, { model: 'local-model', content: '{"draft":"bounded"}' });
  assert.equal(artifact.signal_id, job.signal_id);
  assert.equal(artifact.input_hash, job.input_hash);
  assert.match(artifact.output_hash, /^sha256:[a-f0-9]{64}$/);
  assert.equal(artifact.economic_claims.payment_claim, false);
  assert.equal(artifact.external_action_performed, false);
});

test('prepared output remains behind existing authority boundary', () => {
  assert.deepEqual(preparedBoundary(), {
    external_action_required: true,
    approval_required: true,
    revenue_claim_allowed: false
  });
});
