'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const feedback = require('../distribution/DistributionFeedback');

test('distribution feedback does not promote without a verified payment', () => {
  const r = feedback.evaluate({qualified_targets:2,responses:0,human_minutes:5,verified_payments:0});
  assert.equal(r.decision,'CONTINUE');
  assert.equal(r.evidence_status,'NO_VERIFIED_PAYMENT');
});

test('distribution feedback kills after target limit with no response', () => {
  const r = feedback.evaluate({qualified_targets:10,responses:0,human_minutes:10,verified_payments:0});
  assert.equal(r.decision,'KILL');
});

test('distribution feedback follows up on an external response', () => {
  const r = feedback.evaluate({qualified_targets:3,responses:1,human_minutes:5,verified_payments:0});
  assert.equal(r.decision,'FOLLOW_UP');
});

test('distribution feedback promotes only when payment target is met', () => {
  const r = feedback.evaluate({qualified_targets:3,responses:1,human_minutes:5,verified_payments:1});
  assert.equal(r.decision,'PROMOTE');
});
