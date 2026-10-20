'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');

const contract = JSON.parse(fs.readFileSync(path.join(root, 'config/truth-oracle-contract.json'), 'utf8'));
const oracle = require('../truth-oracle/claim-assessor.js');

assert.equal(contract.schema_version, 'dreamledger/truth-oracle-contract/v1');
assert.equal(contract.contract_id, 'DREAMLEDGER_TRUTH_ORACLE_EVIDENCE_CONTRACT');
assert.deepEqual(contract.statuses, ['VERIFIED', 'LIKELY', 'UNCERTAIN', 'UNVERIFIED', 'CONTRADICTED']);
assert.equal(contract.defaults.model_agreement_is_independent_evidence, false);
assert.equal(contract.defaults.fail_closed_on_missing_provenance, true);
assert.equal(contract.defaults.numerical_confidence_requires_calibration_record, true);
assert.equal(contract.evidence_attestation.required, true);
assert.equal(contract.evidence_attestation.algorithm, 'Ed25519');
assert.equal(contract.evidence_attestation.trusted_public_keys_configured_out_of_band, true);
assert.equal(contract.signing.algorithm, 'Ed25519');
assert.equal(contract.signing.private_key_must_never_be_committed, true);
assert.equal(contract.signing.signature_proves_receipt_integrity_not_claim_truth, true);
assert.equal(contract.payment.x402_enabled, false);
assert.equal(contract.payment.payment_signal_is_not_claim_evidence, true);
assert.equal(contract.payment.receipt_is_not_revenue_evidence, true);
for (const field of contract.evidence_fields_required) assert.ok(field);
for (const field of contract.deterministic_check_fields_required) assert.ok(field);
assert.equal(typeof oracle.assessClaim, 'function');
assert.equal(typeof oracle.signReceipt, 'function');
assert.equal(typeof oracle.verifySignedReceipt, 'function');

console.log(JSON.stringify({
  status: 'PASS',
  contract_id: contract.contract_id,
  verdict_states: contract.statuses,
  signed_evidence_required: true,
  x402_enabled: contract.payment.x402_enabled,
  confidence_requires_calibration: true
}, null, 2));
