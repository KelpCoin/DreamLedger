import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const registry = read('BEC-PRIME/cube/CUBE-SILO-REGISTRY.json');
const factory = read('BEC-PRIME/cube/CUBE-SILO-FACTORY-CONTRACT.json');
const cloneContract = read('BEC-PRIME/cube/CUBE-CLONE-CONTRACT.json');
const money = read('BEC-PRIME/cube/CUBE-MONEY-SURFACES.json');
const scaling = read('BEC-PRIME/cube/CUBE-SWARM-ECONOMIC-GATES.json');
const scaleGate = fs.readFileSync(path.join(root, "workers/economic/cube_swarm_scale_gate.py"), "utf8");
const queue = read('ops/silo-factory/CUBE-SILO-EXPANSION-QUEUE.json');

test('CUBE registry and factory agree on every canonical slug', () => {
  const ids = registry.silos.map(s => s.id);
  const slugs = registry.silos.map(s => s.slug);
  assert.equal(new Set(ids).size, ids.length, 'duplicate silo IDs');
  assert.equal(new Set(slugs).size, slugs.length, 'duplicate canonical slugs');
  assert.deepEqual(factory.silos, slugs);
  assert.deepEqual(cloneContract.allowed_silos, ids);
  assert.equal(registry.neutral_host, 'DreamLedger');
  assert.equal(registry.cross_silo_data, false);
});

test('MTG remains the master silo with the zero-fee liquidity rule', () => {
  const mtg = registry.silos.find(s => s.slug === 'mtg');
  assert.ok(mtg);
  assert.equal(queue.master_silo, 'mtg');
  assert.equal(mtg.commercial_model.peer_success_fee_pct, 0);
  assert.equal(mtg.provisioned, false);
  assert.equal(mtg.cube_worker_scaling_authorized, false);
  assert.ok(mtg.existing_source_paths.includes('public/silos/mtg/silo.json'));
});

test('new categories remain empty scaffolds and cannot auto-publish', () => {
  assert.ok(registry.silos.length >= 30);
  for (const silo of registry.silos) {
    assert.equal(silo.provisioned, false, silo.slug);
    assert.equal(silo.custom_domain_bound, false, silo.slug);
    assert.equal(silo.checkout_verified, false, silo.slug);
    assert.equal(silo.fulfillment_verified, false, silo.slug);
    assert.equal(silo.public_activation_authorized, false, silo.slug);
    assert.equal(silo.cube_worker_scaling_authorized, false, silo.slug);
    assert.equal(silo.catalog_policy, 'EMPTY_FOR_NEW_SILOS; NEVER COPY MTG OR OTHER SILO INVENTORY');
  }
  assert.ok(registry.silos.some(s => s.slug === 'womens-clothing'));
  assert.ok(registry.silos.some(s => s.slug === 'baby-kids'));
  assert.ok(registry.silos.some(s => s.slug === 'media-music'));
  assert.ok(registry.silos.some(s => s.slug === 'b2b'));
  assert.ok(registry.silos.some(s => s.slug === 'delivery-eta'));
});

test('domain values are proposals, not provisioning claims', () => {
  for (const silo of registry.silos) {
    assert.match(silo.proposed_custom_domain, /\.dreamledger\.org$/);
    assert.equal(silo.custom_domain_bound, false);
    assert.equal(silo.runtime_isolation_verified, false);
    assert.equal(silo.rls_verified, false);
  }
  assert.equal(queue.domain_binding_performed, false);
  assert.equal(queue.database_tenant_provisioning_performed, false);
});

test('economic readiness rejects claims unsupported by live settlement and fulfillment', () => {
  assert.equal(registry.economic_truth.verified_external_revenue_nzd, 0);
  assert.equal(scaling.verified_external_revenue_nzd, 0);
  assert.equal(scaling.current_action.new_workers_authorized, 0);
  assert.equal(scaling.current_action.production_scale_mutation, false);
  assert.equal(scaling.status, 'HOLD_NO_VERIFIED_ECONOMIC_EVIDENCE');
  assert.equal(scaling.current_action.action, 'HOLD_BASELINE_PREPARE_ONLY');
  assert.equal(scaling.current_action.new_workers_authorized, 0);
  assert.equal(scaling.current_action.production_scale_mutation, false);
  assert.ok(scaling.policy_rules.some(rule => /simulation/i.test(rule) && /cannot/i.test(rule)));
  assert.equal(money.commercial_ladder_status, 'UNVALIDATED_HYPOTHESIS_NOT_APPROVED_FOR_PUBLIC_PUBLICATION');
  const billboard = registry.commercial_surfaces.find(s => s.id === 'DREAMLEDGER-BILLBOARD-FOUNDING-001');
  assert.equal(billboard.production_checkout_verified, false);
  assert.equal(billboard.fulfillment_verified, false);
  const diagnostic = registry.commercial_surfaces.find(s => s.id === 'COMMANDER-DECK-DIAGNOSTIC-001');
  assert.equal(diagnostic.status, 'HELD');
  assert.equal(diagnostic.production_checkout_verified, false);
});

test('the expansion queue does not count simulations or generated signals as revenue', () => {
  assert.equal(queue.economic_truth.verified_external_revenue_nzd, 0);
  assert.equal(queue.economic_truth.active_worker_scaling_evidence, false);
  assert.ok(queue.economic_truth.claim_exclusions.includes('simulation throughput'));
  assert.ok(queue.rollout_gates.includes('unit contribution margin is positive after fees, refunds, fulfillment and platform costs'));
});

test('scale gate uses platform revenue, not GMV, and remains decision-only', () => {
  assert.equal(scaling.evidence_schema, 'bec/cube-scale-evidence/v2');
  assert.ok(scaling.contribution_formula.includes('platform_revenue_nzd'));
  assert.ok(scaling.contribution_formula.includes('gross_amount_nzd represents GMV'));
  assert.ok(scaling.zero_fee_marketplace_rule.includes('0%'));
  assert.ok(scaling.visitor_denominator_rule.includes('cannot exceed'));
  assert.ok(scaleGate.includes('platform_revenue_nzd - fees - fulfilment_cost - provider_cost - platform_refund_cost'));
  assert.ok(scaleGate.includes('BUYER_COUNT_EXCEEDS_QUALIFIED_VISITOR_DENOMINATOR'));
  assert.equal(scaling.current_action.new_workers_authorized, 0);
  assert.equal(scaling.current_action.production_scale_mutation, false);
});
