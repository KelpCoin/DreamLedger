'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '../..');
const file = path.join(root, 'config/silo-growth-defaults.json');
const contract = JSON.parse(fs.readFileSync(file, 'utf8'));

assert.equal(contract.schema_version, '1.0.0');
assert.equal(contract.contract_id, 'DREAMLEDGER_SILO_GROWTH_DEFAULTS');

const exp = contract.experience;
assert.equal(exp.marketplace_is_primary, true);
assert.equal(exp.creator_support_is_optional, true);
assert.equal(exp.creator_support_must_not_gate_marketplace, true);
assert.equal(exp.promotion_style, 'quiet');
assert.ok(!exp.allowed_placements.includes('blocking_modal'));
assert.ok(exp.forbidden_patterns.includes('blocking_modal'));

const support = contract.creator_support;
assert.equal(support.paid_content_may_not_be_copied_to_public_channels, true);
assert.equal(support.membership_entitlement_must_be_respected, true);
if (support.destination_status !== 'VERIFIED') {
  assert.equal(support.destination_url, null, 'Unverified creator-support destinations must fail closed');
}

const qr = contract.qr;
assert.equal(qr.destination_policy, 'stable_first_party_silo_url');
assert.equal(qr.do_not_encode_temporary_third_party_urls, true);
if (qr.destination_url === null) {
  assert.equal(qr.enabled_when_canonical_url_verified, true);
}

const distribution = contract.distribution;
assert.equal(distribution.canonical_content_record_required, true);
assert.equal(distribution.external_auto_publish, false, 'External publishing stays approval-gated until an authorized integration is verified');
assert.equal(distribution.approval_required_for_publication, true);
assert.equal(distribution.no_unsolicited_bulk_messages, true);

const measurement = contract.measurement;
assert.equal(measurement.clicks_are_not_revenue, true);
assert.equal(measurement.free_memberships_are_not_paid_revenue, true);
assert.equal(measurement.revenue_requires_settlement_and_fulfillment_evidence, true);

const gates = contract.human_gates;
assert.equal(gates.first_publication_requires_approval, true);
assert.equal(gates.new_destination_requires_verification, true);
assert.equal(gates.paid_content_boundary_changes_require_approval, true);
assert.equal(gates.production_payment_changes_require_separate_approval, true);

assert.ok(Array.isArray(contract.clone_inputs_required));
for (const field of ['silo_id', 'silo_slug', 'canonical_url', 'marketplace_fee_policy', 'creator_support_label']) {
  assert.ok(contract.clone_inputs_required.includes(field), 'Missing clone input: ' + field);
}

console.log(JSON.stringify({
  status: 'PASS',
  contract_id: contract.contract_id,
  checks: 22,
  destinations_fail_closed: true,
  external_publication_approval_gated: true
}, null, 2));
