#!/usr/bin/env node
'use strict';

/**
 * Generate candidate toll offers from explicitly registered, existing capabilities.
 *
 * This is a catalogue compiler, not a fake-road generator:
 * - no random IDs, invented endpoints, or duplicate padding;
 * - deterministic IDs/content hashes;
 * - every output is CANDIDATE, never published or checkout-ready;
 * - candidates retain source provenance and require demand, cost, acceptance-test,
 *   payment, entitlement, and fulfilment gates before publication.
 *
 * Input:
 * {
 *   "schema": "dreamledger/pipeline-capability-registry/v1",
 *   "capabilities": [{
 *     "id": "TRUTH-LOOKUP", "pipeline_id": "truth-oracle",
 *     "operation": "classify-evidence", "route": "/api/truth/classify",
 *     "description": "...", "source_ref": "path/to/implementation.js",
 *     "acceptance_test": "node --test path/to/test.js",
 *     "base_price_nzd": 9, "estimated_cost_nzd": null, "enabled": true
 *   }]
 * }
 *
 * Usage:
 * node BEC-PRIME/scripts/generate-toll-road-candidates.js \
 *   --input BEC-PRIME/catalog/pipeline-capabilities.json \
 *   --output artifacts/toll-road-candidates.json
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const SCHEMA = 'dreamledger/toll-road-candidate-catalog/v1';
const INPUT_SCHEMA = 'dreamledger/pipeline-capability-registry/v1';
const DEFAULT_TIERS = [
  { id: 'single', calls: 1, multiplier: 1.0 },
  { id: 'micro-10', calls: 10, multiplier: 8.0 },
  { id: 'starter-100', calls: 100, multiplier: 60.0 },
  { id: 'builder-1000', calls: 1000, multiplier: 450.0 },
  { id: 'scale-10000', calls: 10000, multiplier: 3500.0 },
  { id: 'bulk-100000', calls: 100000, multiplier: 25000.0 }
];
const MIN_MARGIN = 0.60;

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}
function stableId(value) {
  return 'TOLL-CAND-' + sha256(value).slice(0, 24).toUpperCase();
}
function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) throw new Error('Unexpected argument: ' + argv[i]);
    const key = argv[i].slice(2);
    if (key === 'help') { args.help = true; continue; }
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) throw new Error('Missing value for --' + key);
    args[key] = value;
    i += 1;
  }
  return args;
}
function usage() {
  return 'Usage: node BEC-PRIME/scripts/generate-toll-road-candidates.js --input <registry.json> --output <catalog.json>';
}
function validateCapability(cap, index) {
  const required = ['id', 'pipeline_id', 'operation', 'route', 'description', 'source_ref', 'acceptance_test'];
  for (const field of required) {
    if (typeof cap[field] !== 'string' || !cap[field].trim()) {
      throw new Error('capabilities[' + index + '].' + field + ' must be a non-empty string');
    }
  }
  if (!/^\/api\/[a-zA-Z0-9/_:{}.-]+$/.test(cap.route)) {
    throw new Error('capabilities[' + index + '].route must be a canonical /api route');
  }
  if (!Number.isFinite(Number(cap.base_price_nzd)) || Number(cap.base_price_nzd) <= 0) {
    throw new Error('capabilities[' + index + '].base_price_nzd must be a positive baseline price');
  }
  if (cap.estimated_cost_nzd !== null && cap.estimated_cost_nzd !== undefined &&
      (!Number.isFinite(Number(cap.estimated_cost_nzd)) || Number(cap.estimated_cost_nzd) < 0)) {
    throw new Error('capabilities[' + index + '].estimated_cost_nzd must be null or a non-negative number');
  }
  if (cap.enabled !== true) return false;
  return true;
}
function buildCandidates(registry, options = {}) {
  if (!registry || registry.schema !== INPUT_SCHEMA || !Array.isArray(registry.capabilities)) {
    throw new Error('Input schema must be ' + INPUT_SCHEMA + ' with a capabilities array');
  }
  const tiers = options.tiers || DEFAULT_TIERS;
  const seen = new Set();
  const candidates = [];
  let skippedDisabled = 0;
  for (let i = 0; i < registry.capabilities.length; i += 1) {
    const cap = registry.capabilities[i];
    const enabled = validateCapability(cap, i);
    if (!enabled) { skippedDisabled += 1; continue; }
    const canonicalSource = {
      id: cap.id.trim(),
      pipeline_id: cap.pipeline_id.trim(),
      operation: cap.operation.trim(),
      route: cap.route.trim(),
      source_ref: cap.source_ref.trim(),
      acceptance_test: cap.acceptance_test.trim()
    };
    const sourceHash = sha256(JSON.stringify(canonicalSource));
    for (const tier of tiers) {
      if (!tier || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(tier.id) ||
          !Number.isInteger(tier.calls) || tier.calls < 1 ||
          !Number.isFinite(tier.multiplier) || tier.multiplier <= 0) {
        throw new Error('Invalid pricing tier definition');
      }
      const costKnown = cap.estimated_cost_nzd !== null && cap.estimated_cost_nzd !== undefined;
      const cost = costKnown ? roundMoney(Number(cap.estimated_cost_nzd) * tier.calls) : null;
      const floor = costKnown ? cost / (1 - MIN_MARGIN) : 0;
      const amount = roundMoney(Math.max(0.5, floor, Number(cap.base_price_nzd) * tier.multiplier));
      const identity = [canonicalSource.pipeline_id, canonicalSource.id, tier.id].join(':');
      const id = stableId(identity);
      if (seen.has(id)) throw new Error('Duplicate candidate identity: ' + identity);
      seen.add(id);
      const candidate = {
        schema: 'dreamledger/toll-road-candidate/v1',
        id,
        canonical_identity: identity,
        source: {
          capability_id: canonicalSource.id,
          pipeline_id: canonicalSource.pipeline_id,
          operation: canonicalSource.operation,
          route: canonicalSource.route,
          source_ref: canonicalSource.source_ref,
          source_hash: sourceHash,
          acceptance_test: canonicalSource.acceptance_test
        },
        offer: {
          tier: tier.id,
          calls_per_pack: tier.calls,
          price_nzd: amount,
          estimated_cost_nzd: cost,
          unit_economics_status: costKnown ? 'ESTIMATE_UNVERIFIED' : 'UNKNOWN',
          estimated_gross_margin_percent: !costKnown || amount === 0 ? null : roundMoney((amount - cost) / amount * 100)
        },
        demand: { signals: [], independent_buyer_count: 0, evidence: 'UNVERIFIED' },
        gates: {
          capability_test_passed: false,
          unit_economics_reviewed: false,
          demand_verified: false,
          checkout_verified: false,
          settlement_verified: false,
          entitlement_verified: false,
          fulfilment_verified: false,
          delivery_receipt_verified: false,
          publish_authorized: false
        },
        lifecycle: 'CANDIDATE',
        checkout_url: null,
        published_at: null,
        generated_at: options.generatedAt || new Date().toISOString()
      };
      candidate.content_hash = sha256(JSON.stringify(candidate));
      candidates.push(candidate);
    }
  }
  const ids = new Set(candidates.map(c => c.id));
  if (ids.size !== candidates.length) throw new Error('Candidate IDs are not unique');
  return {
    schema: SCHEMA,
    status: 'CANDIDATE_ONLY',
    generated_at: options.generatedAt || new Date().toISOString(),
    source_registry_schema: registry.schema,
    source_capability_count: registry.capabilities.length,
    enabled_capability_count: registry.capabilities.length - skippedDisabled,
    disabled_capability_count: skippedDisabled,
    candidate_count: candidates.length,
    active_road_count: 0,
    published_road_count: 0,
    verified_revenue_nzd: 0,
    design_target_roads: 200000,
    target_is_capacity_not_inventory: true,
    candidates
  };
}
function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { process.stdout.write(usage() + '\n'); return; }
  if (!args.input || !args.output) throw new Error(usage());
  const input = path.resolve(args.input);
  const output = path.resolve(args.output);
  const registry = JSON.parse(fs.readFileSync(input, 'utf8'));
  const result = buildCandidates(registry);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', 'utf8');
  process.stdout.write(JSON.stringify({
    output,
    candidate_count: result.candidate_count,
    active_road_count: result.active_road_count,
    published_road_count: result.published_road_count,
    status: result.status
  }) + '\n');
}
if (require.main === module) {
  try { main(); } catch (error) {
    process.stderr.write(String(error && error.message || error) + '\n');
    process.exitCode = 1;
  }
}
module.exports = { SCHEMA, INPUT_SCHEMA, DEFAULT_TIERS, buildCandidates, stableId, sha256 };
