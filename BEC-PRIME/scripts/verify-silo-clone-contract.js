'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { validateSiloCloneContract } = require('../lib/siloCloneContract');

function validContract() {
  return {
    silo_id: 'mtg',
    fee_policy: { platform_fee_bps: 0 },
    authorship: { declared_tier: 'AAC', production_mode: 'AI_ASSISTED', human_review_required: true },
    support: { status: 'VERIFIED', url: 'https://www.patreon.com/HappyHomarid' },
    content: { canonical_record_id: 'article-001', public_cutoff: 'heading: members-only section', paid_content_public_distribution: false },
    measurement: { evidence_path: 'records/attribution/mtg' },
    commerce: { checkout_enabled: true, inventory_verified: true, fulfillment_contract_verified: true, settlement_required: true, delivery_proof_required: true },
    x402: { enabled: false }
  };
}

test('valid reusable silo contract passes', () => {
  const result = validateSiloCloneContract(validContract());
  assert.equal(result.status, 'PASS');
  assert.equal(result.publish_allowed, true);
});

test('missing inventory evidence blocks checkout', () => {
  const contract = validContract();
  contract.commerce.inventory_verified = false;
  const result = validateSiloCloneContract(contract);
  assert.equal(result.status, 'BLOCK');
  assert.ok(result.errors.some(e => e.code === 'CHECKOUT_INVENTORY_UNVERIFIED'));
});

test('declared authorship cannot contradict production mode', () => {
  const contract = validContract();
  contract.authorship.declared_tier = 'HCC';
  const result = validateSiloCloneContract(contract);
  assert.ok(result.errors.some(e => e.code === 'AUTHORSHIP_TIER_MISMATCH'));
});

test('paid content cannot enter public distribution', () => {
  const contract = validContract();
  contract.content.paid_content_public_distribution = true;
  const result = validateSiloCloneContract(contract);
  assert.ok(result.errors.some(e => e.code === 'PAYWALL_LEAK_RISK'));
});

test('unconfigured optional support destination is dormant, not a fake live link', () => {
  const contract = validContract();
  contract.support = { status: 'NOT_CONFIGURED' };
  const result = validateSiloCloneContract(contract);
  assert.equal(result.status, 'PASS');
  assert.ok(result.warnings.some(w => w.code === 'SUPPORT_DESTINATION_DORMANT'));
});

test('x402 live endpoint blocks placeholders and missing approval', () => {
  const contract = validContract();
  contract.x402 = { enabled: true, network: 'CONFIGURE_BEFORE_LIVE', asset: 'USDC', pay_to: '0xabc', facilitator: 'https://facilitator.example', live_approved: false };
  const result = validateSiloCloneContract(contract);
  assert.ok(result.errors.some(e => e.code === 'X402_NETWORK_INVALID'));
  assert.ok(result.errors.some(e => e.code === 'X402_LIVE_APPROVAL_REQUIRED'));
});

test('fee policy must preserve explicit per-silo economics', () => {
  const contract = validContract();
  contract.fee_policy.platform_fee_bps = -1;
  const result = validateSiloCloneContract(contract);
  assert.ok(result.errors.some(e => e.code === 'FEE_POLICY_INVALID'));
});
