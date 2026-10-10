'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Factory = require('./TollRoadFactory');

test('exposes exactly 10,000 stable, separately namespaced road IDs', () => {
  assert.equal(Factory.ROAD_COUNT, 10000);
  assert.equal(Factory.getRoad('ROAD-000001').road_id, 'ROAD-000001');
  assert.equal(Factory.getRoad('ROAD-010000').road_id, 'ROAD-010000');
  assert.equal(Factory.getRoad('ROAD-000001').route, Factory.getRoad('ROAD-000001').route);
  assert.notEqual(Factory.getRoad('ROAD-000001').road_id, Factory.getRoad('ROAD-000002').road_id);
});

test('rejects malformed and out-of-range road IDs', () => {
  assert.equal(Factory.getRoad('ROAD-000000'), null);
  assert.equal(Factory.getRoad('ROAD-010001'), null);
  assert.equal(Factory.getRoad('../ROAD-000001'), null);
  assert.equal(Factory.getRoad('ROAD-ABCDEF'), null);
});

test('catalogue is paginated and never returns more than 100 roads', () => {
  const first = Factory.listRoads({ offset: 0, limit: 100 });
  const last = Factory.listRoads({ offset: 9900, limit: 100 });
  assert.equal(first.count, 10000);
  assert.equal(first.roads.length, 100);
  assert.equal(first.next_offset, 100);
  assert.equal(last.roads.length, 100);
  assert.equal(last.next_offset, null);
  assert.equal(last.roads[99].road_id, 'ROAD-010000');
  assert.equal(Factory.listRoads({ offset: 0, limit: 101 }).error, 'limit_must_be_between_1_and_100');
});

test('road product makes no persistence or downstream-action claim', () => {
  const road = Factory.getRoad('ROAD-000042');
  assert.equal(road.price_nzd, 1);
  assert.equal(road.calls_per_pack, 100);
  assert.equal(road.service_model, 'bounded_receipt_only');
  assert.equal(road.economic_status, 'UNVERIFIED_UNTIL_EXTERNAL_SETTLEMENT_AND_FULFILLMENT_EVIDENCE');
});

test('toll access keys are bound to one exact road ID', () => {
  const Toll = require('./TollRoad');
  const prior = process.env.DREAMLEDGER_TOLL_KEY_SECRET;
  process.env.DREAMLEDGER_TOLL_KEY_SECRET = 'test-only-road-secret';
  try {
    const token = Toll.issueKey({ tier: 'road', roadId: 'ROAD-000042', callsRemaining: 100 });
    assert.equal(Toll.verifyKey(token, { requiredTier: 'road', requiredRoadId: 'ROAD-000042' }).ok, true);
    assert.equal(Toll.verifyKey(token, { requiredTier: 'road', requiredRoadId: 'ROAD-000043' }).error, 'toll_key_road_denied');
    assert.equal(Toll.verifyKey(token, { requiredTier: 'truth', requiredRoadId: 'ROAD-000042' }).error, 'toll_key_scope_denied');
  } finally {
    if (prior === undefined) delete process.env.DREAMLEDGER_TOLL_KEY_SECRET;
    else process.env.DREAMLEDGER_TOLL_KEY_SECRET = prior;
  }
});
