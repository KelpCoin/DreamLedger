'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

process.env.DREAMLEDGER_TOLL_KEY_SECRET = 'test-only-secret-v2';

const Toll = require('./TollRoad');

test('v1-compatible keys still work', () => {
  const key = Toll.issueKey({ keyId: 'TEST-1', tier: 'gauntlet', callsRemaining: 3 });
  const ok = Toll.verifyKey(key, 'gauntlet');
  assert.equal(ok.ok, true);
  assert.equal(ok.payload.key_id, 'TEST-1');
  assert.equal(Toll.verifyKey(key, 'truth').ok, false);
});

test('v2 keys are signed, road-scoped, expirable and fail closed', () => {
  const key = Toll.issueKey({
    keyId: 'TEST-ROAD-1',
    tier: 'road',
    roadId: 'ROAD-ABC',
    ownerPassportId: 'PASSPORT-NZ-001',
    callsRemaining: 5
  });
  const ok = Toll.verifyKey(key, { requiredTier: 'road', requiredRoadId: 'ROAD-ABC' });
  assert.equal(ok.ok, true);
  assert.equal(ok.payload.key_id, 'TEST-ROAD-1');
  assert.equal(ok.payload.road_id, 'ROAD-ABC');
  assert.equal(ok.payload.calls_remaining, 5);

  // wrong road
  assert.equal(Toll.verifyKey(key, { requiredRoadId: 'ROAD-OTHER' }).ok, false);
  // wrong tier
  assert.equal(Toll.verifyKey(key, { requiredTier: 'gauntlet' }).ok, false);
  // tamper
  const tampered = key.slice(0, -1) + (key.endsWith('a') ? 'b' : 'a');
  assert.equal(Toll.verifyKey(tampered).ok, false);
});

test('createRoadDescriptor produces valid road object', () => {
  const road = Toll.createRoadDescriptor({
    ownerPassportId: 'PASSPORT-NZ-001',
    slug: 'My Cool API!',
    title: 'My Cool API',
    priceNzd: 29,
    callsPerPack: 500
  });
  assert.ok(road.road_id.startsWith('ROAD-'));
  assert.equal(road.slug, 'my-cool-api-');
  assert.equal(road.price_nzd, 29);
  assert.equal(road.calls_per_pack, 500);
  assert.equal(road.status, 'draft');
});

test('issueEntitlementForRoad returns key bound to road', () => {
  const road = Toll.createRoadDescriptor({
    ownerPassportId: 'PASSPORT-NZ-002',
    slug: 'tools-api',
    title: 'Tools API',
    callsPerPack: 100
  });
  const ent = Toll.issueEntitlementForRoad(road, 'pi_test_123', 'buyer@example.com');
  assert.ok(ent.key.startsWith('dlk_'));
  assert.equal(ent.road_id, road.road_id);
  assert.equal(ent.calls_remaining, 100);
  const verified = Toll.verifyKey(ent.key, { requiredRoadId: road.road_id });
  assert.equal(verified.ok, true);
  assert.equal(verified.payload.road_id, road.road_id);
});

test('publicManifest reports v2 and design target', () => {
  const m = Toll.publicManifest();
  assert.equal(m.schema, 'dreamledger/toll-road/v2');
  assert.equal(m.design_target_roads, 200000);
  assert.ok(Array.isArray(m.services));
});
