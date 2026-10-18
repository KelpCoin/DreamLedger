'use strict';
const assert = require('node:assert/strict');
const policy = require('../lib/siloFeePolicy');
const commercial = require('../../config/commercial-rules.json');

for (const silo of ['mtg', 'pokemon', 'lorcana', 'accounting', 'dental', 'amplissa', 'unrelated']) {
  assert.equal(policy.resolve(silo, 'human_to_human').platform_fee_bps, 0, silo + ' H2H fee must remain free');
  assert.equal(policy.assert(silo, 0, 'human_to_human').platform_fee_bps, 0);
  assert.throws(() => policy.assert(silo, 200, 'human_to_human'), /SILO_FEE_POLICY_VIOLATION/);
  assert.equal(policy.resolve(silo, 'machine_to_machine').platform_fee_bps, 200, silo + ' A2A policy must be 2%');
}
assert.equal(policy.resolve('MTG').platform_fee_bps, 0);
assert.equal(commercial.principles.browsing.price_nzd, 0);
assert.equal(commercial.principles.listing_creation.price_nzd, 0);
assert.equal(commercial.principles.b2b_participation.platform_fee_bps, 0);
assert.equal(commercial.paid_visibility.enabled_by_default, false);
assert.equal(policy.canPromote({tenantPlan:{featured_listings:true},featureEnabled:false,paymentVerified:true,fulfillmentVerified:true}), false);
assert.equal(policy.canPromote({tenantPlan:{featured_listings:true},featureEnabled:true,paymentVerified:true,fulfillmentVerified:true}), true);
assert.equal(policy.canPromote({tenantPlan:{featured_listings:false},featureEnabled:true,paymentVerified:true,fulfillmentVerified:true}), false);
assert.equal(policy.canPromote({tenantPlan:{featured_listings:true},featureEnabled:true,paymentVerified:false,fulfillmentVerified:true}), false);
assert.equal(policy.canPromote({tenantPlan:{featured_listings:true},featureEnabled:true,paymentVerified:true,fulfillmentVerified:false}), false);
assert.equal(policy.canChargeA2A({featureEnabled:false,paymentVerified:true,settlementVerified:true}), false);
assert.equal(policy.canChargeA2A({featureEnabled:true,paymentVerified:true,settlementVerified:true}), true);
assert.equal(policy.isPromoted({is_promoted:true}), true);
assert.equal(policy.isPromoted({is_promoted:'true'}), false);
console.log('PASS: free H2H/B2B rules, gated A2A fee, and optional paid-visibility contract.');
console.log('Status: x402 and paid visibility remain disabled until live payment and fulfillment paths are verified.');
console.log('Policy SHA256: ' + policy.policySha256());
