import test from 'node:test';
import assert from 'node:assert/strict';
import { runElohimProductPipeline } from './kelphaven-elohim-product-pipeline.mjs';

const evidence = [{
  source: 'fixture:unit-cost-receipt',
  retrieved_at: '2026-10-20T00:00:00.000Z',
  kind: 'seller_unit_cost',
  sha256: 'a'.repeat(64)
}];

const validInput = {
  kind: 'marketplace_product',
  product_candidate: {
    id: 'MTG-CARD-EXAMPLE-001',
    sku: 'MTG-CARD-EXAMPLE-001',
    name: 'Example MTG card',
    silo: 'mtg',
    description: 'Draft listing for a Magic: The Gathering single. Listing remains unpublished until reviewed.'
  },
  pricing: {
    currency: 'NZD',
    unit_cost_nzd: 10,
    transaction_cost_nzd: 1,
    fulfilment_cost_nzd: 2,
    tax_reserve_nzd: 0,
    target_margin_pct: 30,
    evidence
  }
};

test('Elohim price pipeline calculates a traceable price and runs the actual CandidateGauntlet', () => {
  const result = runElohimProductPipeline(validInput);
  assert.equal(result.status, 'READY_FOR_HUMAN_REVIEW');
  assert.equal(result.price_nzd, 18.58);
  assert.equal(result.currency, 'NZD');
  assert.equal(result.gauntlet.status, 'PASS');
  assert.ok(result.gauntlet.checks.some((c) => c.id === 'candidate.pricing_evidence'));
  assert.equal(result.draft_product.status, 'draft');
  assert.equal(result.draft_product.checkout_available, false);
  assert.equal(result.may_publish, false);
  assert.equal(result.may_charge, false);
  assert.equal(result.external_evidence_status, 'UNVERIFIED');
});

test('missing market price evidence produces a hold, not an invented default price', () => {
  const result = runElohimProductPipeline({
    product_candidate: { id: 'NO-PRICE-001', name: 'No price product', silo: 'mtg' },
    pricing: { unit_cost_nzd: 10, target_margin_pct: 30, evidence: [] }
  });
  assert.equal(result.status, 'HELD_NO_PRICE_EVIDENCE');
  assert.equal(result.price_nzd, null);
  assert.equal(result.gauntlet.status, 'NOT_RUN');
  assert.equal(result.may_publish, false);
});

test('bad or unhashed evidence fails closed', () => {
  const result = runElohimProductPipeline({
    ...validInput,
    pricing: { ...validInput.pricing, evidence: [{ source: 'quote', retrieved_at: 'not-a-date', kind: 'price' }] }
  });
  assert.equal(result.status, 'HELD_NO_PRICE_EVIDENCE');
  assert.ok(result.errors.length > 0);
  assert.equal(result.price_nzd, null);
});

test('Gauntlet rejects pricing below the evidenced cost floor', () => {
  const result = runElohimProductPipeline({
    ...validInput,
    pricing: { ...validInput.pricing, target_margin_pct: 30, unit_cost_nzd: -1 }
  });
  assert.equal(result.status, 'HELD_NO_PRICE_EVIDENCE');
  assert.equal(result.price_nzd, null);
});
