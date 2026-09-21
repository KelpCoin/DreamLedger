'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const contract = require('../runtime/ActuatorReadyContract');

test('cell contract validates a complete ready cell', () => {
  const cell = contract.validateCell({
    cell_id: 'CELL-001',
    object: 'Commander Deck Diagnostic',
    buyer: { definition: 'NZ Commander players seeking deck diagnosis' },
    demand: { signal: 'purchase_intent' },
    offer: { sku: 'CMD-DIAG-29', price_nzd: 29, currency: 'NZD' },
    channel: { type: 'public_checkout' },
    fulfillment: { type: 'manual_digital_delivery' },
    attribution: { required: true },
    evidence: { required: true },
    verification_rules: { require_external_buyer: true, require_settlement: true, require_fulfillment: true, require_evidence: true },
    authority_requirements: { external_action: 'HUMAN_AUTHORITY' },
    lifecycle_state: 'READY'
  });
  assert.equal(cell.ok, true);
  assert.equal(cell.lifecycle_state, 'READY');
});

test('business truth cannot verify without the full external chain', () => {
  const result = contract.evaluateBusinessTruth({
    classification: 'OBSERVED',
    external_buyer: true,
    settled_transaction: true,
    attributed: true,
    fulfilled: false,
    evidence: ['e1'],
    external_reference: 'pi_live_001'
  });
  assert.equal(result.status, 'UNVERIFIED');
  assert.deepEqual(result.missing, ['fulfillment']);
});

test('test-mode evidence can never become verified', () => {
  const result = contract.evaluateBusinessTruth({
    classification: 'TEST',
    external_buyer: true,
    settled_transaction: true,
    attributed: true,
    fulfilled: true,
    evidence: ['e1'],
    external_reference: 'pi_test_001'
  });
  assert.equal(result.status, 'TEST');
  assert.ok(result.missing.includes('live_external_event'));
});

test('authority preparation is deterministic and cannot execute', () => {
  const a = contract.prepareAuthority({
    action_type: 'SEND_OFFER',
    payload: { recipient: 'external', offer_id: 'CELL-001' },
    expected_consequence: 'External outreach',
    reversible: false,
    credentials_required: ['human_session'],
    expires_at: '2099-01-01T00:00:00.000Z'
  });
  const b = contract.prepareAuthority({
    action_type: 'SEND_OFFER',
    payload: { recipient: 'external', offer_id: 'CELL-001' },
    expected_consequence: 'External outreach',
    reversible: false,
    credentials_required: ['human_session'],
    expires_at: '2099-01-01T00:00:00.000Z'
  });
  assert.equal(a.state, 'PENDING_AUTHORITY');
  assert.equal(a.execution_allowed, false);
  assert.equal(a.idempotency_key, b.idempotency_key);
});

test('unavailable actuator remains unavailable and never fakes an effect', () => {
  const result = contract.executeWithActuator({
    action_request: { action_id: 'a1', idempotency_key: 'k1' },
    actuator: { status: 'ACTUATOR_UNAVAILABLE' }
  });
  assert.equal(result.state, 'EXTERNAL_ACTUATOR_UNAVAILABLE');
  assert.equal(result.external_effect, null);
  assert.equal(result.external_reference, null);
});

test('replication requires two independent verified buyers', () => {
  assert.equal(contract.replicationStatus([
    { status: 'VERIFIED', buyer_key: 'buyer-a' }
  ]).state, 'VERIFIED_NOT_REPLICABLE');
  assert.equal(contract.replicationStatus([
    { status: 'VERIFIED', buyer_key: 'buyer-a' },
    { status: 'VERIFIED', buyer_key: 'buyer-b' }
  ]).state, 'REPLICABLE');
});

test('invalid lifecycle transitions are rejected', () => {
  assert.throws(
    () => contract.assertTransition('READY', 'VERIFIED'),
    /INVALID_TRANSITION/
  );
});
