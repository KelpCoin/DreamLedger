'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { candidateFromModel } = require('./777_cloud_execution_adapter');
const { run: runGauntlet } = require('../BEC-PRIME/gauntlet/CandidateGauntlet');

test('missing model output cannot manufacture a paid Quote Compare offer', () => {
  const candidate = candidateFromModel({}, { objective: 'find a grounded buyer problem' });
  assert.notEqual(candidate.offer_id, 'QUOTE-COMPARE-49');
  assert.equal(candidate.price, 0);
  assert.equal(candidate.checkout_route, 'UNCONFIGURED_NO_CHECKOUT');
  assert.equal(candidate.checkout_available, false);
  assert.equal(candidate.approval_required, true);
  assert.equal(runGauntlet(candidate).status, 'FAIL');
});

test('a source-grounded existing offer can pass structural checks', () => {
  const source = {
    candidate: {
      offer_id: 'EXISTING-OFFER-19',
      name: 'Existing Offer',
      problem: 'A grounded problem',
      target_buyer: 'A specific buyer segment',
      deliverable: 'An existing deliverable',
      delivery_mechanism: 'Existing fulfillment rail',
      price: 19,
      currency: 'NZD',
      payment_adapter: 'Existing checkout',
      checkout_route: 'https://example.invalid/existing-offer',
      proof_of_delivery: 'Delivery receipt',
      verification_rules: 'Independent verification',
      silo: 'existing-silo',
      kill_condition: 'No demand'
    }
  };
  const candidate = candidateFromModel({}, source);
  assert.equal(candidate.offer_id, 'EXISTING-OFFER-19');
  assert.equal(candidate.price, 19);
  assert.equal(candidate.checkout_route, 'https://example.invalid/existing-offer');
  assert.equal(candidate.checkout_available, false);
  assert.equal(candidate.approval_required, true);
  assert.equal(runGauntlet(candidate).status, 'PASS');
});
