'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createCandidate, createCandidates } = require('../council/ElohimCreate');

test('Elohim creates a deterministic candidate without enabling checkout', () => {
  const capability = {
    id: 'BEC-PRIME-ELOHIM',
    name: 'Elohim Refinery',
    summary: 'Turn validated specifications into executable work.',
    commercialization: 'architecture_or_implementation',
    silo: 'dreamledger'
  };

  const a = createCandidate(capability);
  const b = createCandidate(capability);

  assert.equal(a.id, b.id);
  assert.equal(a.created_by, 'ELOHIM');
  assert.equal(a.checkout_available, false);
  assert.equal(a.approval_required, true);
  assert.equal(a.price_status, 'UNVERIFIED');
});

test('Elohim can create a batch from capabilities and demand signals', () => {
  const candidates = createCandidates([
    { id: 'CAP-1', name: 'One', silo: 'dreamledger' },
    { id: 'CAP-2', name: 'Two', silo: 'dreamledger', tiers: [{ price: 149 }, { price: 499 }] }
  ], [
    { signal_id: 'SIG-1', demand: 'Need one' },
    { signal_id: 'SIG-2', demand: 'Need two' }
  ]);

  assert.equal(candidates.length, 2);
  assert.deepEqual(candidates[1].price_proposal_nzd, [149, 499]);
  assert.equal(candidates[0].provenance.demand_signal_id, 'SIG-1');
});
