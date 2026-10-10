'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  INPUT_SCHEMA, DEFAULT_TIERS, buildCandidates, stableId
} = require('./generate-toll-road-candidates');

const registry = {
  schema: INPUT_SCHEMA,
  capabilities: [
    {
      id: 'TRUTH-CLASSIFY',
      pipeline_id: 'truth-oracle',
      operation: 'classify-evidence',
      route: '/api/truth/classify',
      description: 'Classify supplied evidence into explicit truth states.',
      source_ref: 'BEC-PRIME/scripts/Verify-TruthOracleCommerce.js',
      acceptance_test: 'node --test BEC-PRIME/scripts/test-truth-oracle-economic.js',
      estimated_cost_nzd: 0.01,
      base_price_nzd: 0.5,
      enabled: true
    },
    {
      id: 'BRIDGE-EVENT-INGEST',
      pipeline_id: 'agent-bridge',
      operation: 'ingest-structured-event',
      route: '/api/agent-bridge/events',
      description: 'Validate and ingest a bounded structured bridge event.',
      source_ref: 'BEC-PRIME/runtime/AgentBridge.js',
      acceptance_test: 'node BEC-PRIME/scripts/Verify-AgentBridge-Contract.js',
      estimated_cost_nzd: 0.005,
      base_price_nzd: 0.1,
      enabled: true
    },
    {
      id: 'DISABLED-EXPERIMENT',
      pipeline_id: 'unverified',
      operation: 'unknown',
      route: '/api/not-ready',
      description: 'Not eligible for candidate generation.',
      source_ref: 'not-deployed',
      acceptance_test: 'not-configured',
      estimated_cost_nzd: 0,
      enabled: false
    }
  ]
};

test('candidate count derives only from enabled, registered capabilities and declared tiers', () => {
  const result = buildCandidates(registry, { generatedAt: '2026-10-10T00:00:00.000Z' });
  assert.equal(result.source_capability_count, 3);
  assert.equal(result.enabled_capability_count, 2);
  assert.equal(result.disabled_capability_count, 1);
  assert.equal(result.candidate_count, 2 * DEFAULT_TIERS.length);
  assert.equal(result.active_road_count, 0);
  assert.equal(result.published_road_count, 0);
  assert.equal(result.verified_revenue_nzd, 0);
});

test('all generated records remain unpublished and checkout-disabled', () => {
  const result = buildCandidates(registry);
  for (const candidate of result.candidates) {
    assert.equal(candidate.lifecycle, 'CANDIDATE');
    assert.equal(candidate.checkout_url, null);
    assert.equal(candidate.published_at, null);
    assert.equal(candidate.gates.publish_authorized, false);
    assert.equal(candidate.gates.settlement_verified, false);
    assert.equal(candidate.gates.fulfilment_verified, false);
    assert.equal(candidate.demand.independent_buyer_count, 0);
    assert.equal(candidate.demand.evidence, 'UNVERIFIED');
  }
});

test('identities and content hashes are stable for the same source and tier', () => {
  const first = buildCandidates(registry, { generatedAt: '2026-10-10T00:00:00.000Z' });
  const second = buildCandidates(registry, { generatedAt: '2026-10-10T00:00:00.000Z' });
  assert.deepEqual(first.candidates, second.candidates);
  assert.equal(stableId('truth-oracle:TRUTH-CLASSIFY:single'), stableId('truth-oracle:TRUTH-CLASSIFY:single'));
  assert.notEqual(stableId('truth-oracle:TRUTH-CLASSIFY:single'), stableId('truth-oracle:TRUTH-CLASSIFY:micro-10'));
});

test('invalid registry schema, missing provenance and malformed routes fail closed', () => {
  assert.throws(() => buildCandidates({ schema: 'wrong', capabilities: [] }), /Input schema/);
  assert.throws(() => buildCandidates({
    schema: INPUT_SCHEMA,
    capabilities: [{ id: 'BAD', enabled: true }]
  }), /pipeline_id/);
  const badRoute = structuredClone(registry);
  badRoute.capabilities[0].route = 'https://evil.example/api';
  assert.throws(() => buildCandidates(badRoute), /canonical \/api route/);
});

test('duplicate capability-tier identities are rejected rather than padded', () => {
  const duplicate = structuredClone(registry);
  duplicate.capabilities.splice(1, 0, { ...duplicate.capabilities[0] });
  assert.throws(() => buildCandidates(duplicate), /Duplicate candidate identity/);
});
