'use strict';
const assert = require('node:assert/strict');
const { goldenScore, buildGoldenAllocation } = require('./Run-777');

const high = goldenScore({
  hypothesis: { price_nzd: 10000, buyer: 'procurement team', transformation: 'REPEAT' },
  economic_evidence: { evidence_rung: 4 },
  commercial_activation: { payment_link_url: '/pay', fulfillment_route: '/fulfill', proof_of_delivery: 'artifact' },
  evidence_priority: 70
});
assert.equal(high.authority, 'ALLOCATION_ONLY');
assert.equal(high.replication_permission, false);
assert.ok(high.score > 50);

const rows = [
  { candidate_id: 'A', seed_opportunity_id: 'A', hypothesis: { price_nzd: 10000, buyer: 'buyer', transformation: 'REPEAT' }, economic_evidence: { evidence_rung: 4 }, commercial_activation: { payment_link_url: '/pay', fulfillment_route: '/fulfill', proof_of_delivery: 'x' }, evidence_priority: 70 },
  { candidate_id: 'B', seed_opportunity_id: 'B', hypothesis: { price_nzd: 9 }, economic_evidence: { evidence_rung: 0 }, commercial_activation: {}, evidence_priority: 10 }
];
const allocation = buildGoldenAllocation(rows);
assert.equal(allocation.length, 2);
assert.equal(allocation[0].allocation, 'ELEVATE_INTERNAL');
assert.equal(allocation[0].external_action, 'BLOCKED');
assert.equal(allocation[0].truth_status, 'UNVERIFIED');
console.log('777_AMBER_ROOM_ALLOCATION_TEST=PASS');
