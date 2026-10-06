'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { assemble, elohimProposal } = require('./777-EvergreenRuntime');

const seed = {
  opportunity_id: 'TEST-SEED',
  buyer: 'TEST-BUYER-CLASS',
  hypothesis: 'Compare supplier quotes',
  price_nzd: 49
};

const variants = Array.from({ length: 5 }, (_, i) => ({
  variant_id: 'TEST-VARIANT-' + (i + 1),
  source_capability: 'construction-subcontractor-quotes',
  source_type: 'EVERGREEN_ADAPTER',
  source_checkout_url: null,
  brand_name: 'Quote Comparison ' + (i + 1),
  offer_family: 'SUPPLIER_QUOTE_COMPARISON',
  price_nzd: 49,
  kill_gate: 'NO_QUALIFIED_DEMAND_OR_NO_FULFILLMENT_PROOF'
}));

test('Elohim creates proposals without granting authority', () => {
  const p = elohimProposal(seed, variants[0], { schema: 'TEST', gauntlet: { checks: [] } });
  assert.equal(p.created_by, 'ELOHIM');
  assert.equal(p.approval_required, true);
  assert.equal(p.checkout_available, false);
  assert.equal(p.external_action, 'BLOCKED');
  assert.equal(p.replication_permission, false);
});

test('777 assembles a bounded five-cell population and judges every Elohim output', () => {
  const r = assemble(seed, variants);
  assert.equal(r.status, 'ASSEMBLED_INTERNAL_ONLY');
  assert.equal(r.cube.cells.length, 5);
  assert.equal(r.gauntlet.judged_count, 5);
  assert.ok(r.cube.cells.every(c => c.gauntlet.gauntlet_verdict === 'FAIL'));
  assert.ok(r.cube.cells.every(c => c.authority.external_action === 'BLOCKED'));
  assert.equal(r.truth_oracle.verified_external_revenue_nzd, 0);
  assert.equal(r.evergreen.replication_permission, false);
  assert.equal(r.persistence.no_fake_rows_written, true);
});

console.log('777_EVERGREEN_RUNTIME_TEST=PASS');
