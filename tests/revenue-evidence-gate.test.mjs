import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyEconomicEvidence } from '../ops/commerce/revenue-evidence-gate.mjs';
const paid = { checkoutLivemode: true, checkoutPaid: true, paymentIntentSucceeded: true, chargeUnrefunded: true, exactOfferMatched: true };
test('paid checkout does not prove external revenue', () => {
  const result = classifyEconomicEvidence(paid);
  assert.equal(result.processor_payment_observed, true);
  assert.equal(result.verified_external_revenue, false);
});
test('independent proof, settlement, delivery and costs all required', () => {
  const result = classifyEconomicEvidence({ ...paid, independentBuyerVerified: true, deliveryEvidenceVerified: true, settlementEvidenceVerified: true, actualCostsMeasured: true, measuredContributionNzd: 31.25 });
  assert.equal(result.verified_external_revenue, true);
  assert.equal(result.verified_contribution_nzd, 31.25);
});
test('missing evidence remains explicit', () => {
  assert.equal(classifyEconomicEvidence({}).missing.length, 5);
});
