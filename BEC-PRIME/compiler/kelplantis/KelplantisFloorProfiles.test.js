'use strict';

const assert = require('assert');
const { floorProfile, allFloorProfiles } = require('./KelplantisFloorProfiles');

const floors = allFloorProfiles();
assert.strictEqual(floors.length, 100);
assert.strictEqual(floorProfile(1).canonical_boss_id, 'kelp_floor1_boss');
assert.strictEqual(floorProfile(100).floor_id, 100);
assert.ok(floors.every(f => f.boss_arena_required === true));
assert.ok(floors.every(f => f.rest_room_required === true));
assert.ok(new Set(floors.map(f => f.biome)).size >= 4);
assert.throws(() => floorProfile(0));
assert.throws(() => floorProfile(101));
console.log(JSON.stringify({ status: 'PASS', floors: floors.length, unique_biomes: new Set(floors.map(f => f.biome)).size }, null, 2));
