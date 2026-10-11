'use strict';

const assert = require('node:assert/strict');
const { run } = require('./CandidateGauntlet');

function candidate(overrides = {}) {
  return {
    offer_id: 'TEST-FREE-DISCOVERY',
    name: 'Free evidence discovery',
    problem: 'Provide a source-linked evidence record.',
    target_buyer: 'B2B users and agents',
    deliverable: 'Source-linked evidence record',
    delivery_mechanism: 'Public Truth Oracle',
    price: 0,
    commercial_mode: 'FREE_DISCOVERY',
    currency: 'NZD',
    payment_adapter: 'no default checkout',
    checkout_route: 'not configured',
    approval_required: true,
    checkout_available: false,
    status: 'CANDIDATE',
    proof_of_delivery: 'hash-bound evidence packet',
    verification_rules: 'independent source verification',
    provenance: { private_material: 'excluded', source_hash: 'test' },
    silo: 'truth-oracle',
    kill_condition: 'contradictory evidence',
    ...overrides
  };
}

const free = run(candidate());
assert.equal(free.status, 'PASS', JSON.stringify(free.checks.filter(x => x.status === 'FAIL')));
assert.ok(free.checks.some(x => x.id === 'candidate.price_positive' && x.status === 'PASS'));

const fakeFreeWithCheckout = run(candidate({ checkout_available: true }));
assert.equal(fakeFreeWithCheckout.status, 'FAIL');
assert.ok(fakeFreeWithCheckout.checks.some(x => x.id === 'candidate.price_positive' && x.status === 'FAIL'));

const untypedZero = run(candidate({ commercial_mode: undefined }));
assert.equal(untypedZero.status, 'FAIL');

const paid = run(candidate({ price: 9, commercial_mode: 'PAID_CANDIDATE' }));
assert.equal(paid.status, 'PASS');

console.log('FREE_DISCOVERY_GAUNTLET_TEST=PASS');
