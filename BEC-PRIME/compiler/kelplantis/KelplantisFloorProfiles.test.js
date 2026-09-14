'use strict';

const assert = require('assert');
const { floorProfile, allFloorProfiles, townEconomy } = require('./KelplantisFloorProfiles');

const floors = allFloorProfiles();
assert.strictEqual(floors.length, 100);
assert.strictEqual(floorProfile(1).canonical_boss_id, 'kelp_floor1_boss');
assert.strictEqual(floorProfile(100).floor_id, 100);
assert.ok(floors.every(f => f.boss_arena_required === true));
assert.ok(floors.every(f => f.rest_room_required === true));
assert.ok(new Set(floors.map(f => f.biome)).size >= 4);
assert.throws(() => floorProfile(0));
assert.throws(() => floorProfile(101));

const d1 = townEconomy(1);
const d16 = townEconomy(16);
const d100 = townEconomy(100);
assert.ok(d1.town_plot_slots > d16.town_plot_slots, 'depth scarcity: floor 1 plots > floor 16');
assert.ok(d16.town_plot_slots >= d100.town_plot_slots, 'depth scarcity: floor 16 plots >= floor 100');
assert.ok(d1.billboard_slots >= d100.billboard_slots, 'billboard scarcity with depth');
assert.strictEqual(d1.town_map_size, 40);
assert.ok(d100.town_map_size <= 12);
assert.ok(floors.every(f => f.town_economy && f.town_economy.town_plot_slots >= 3));
assert.ok(floors.every(f => f.town_economy.commerce.settlement === 'dreamledger_stripe_spine'));

console.log(JSON.stringify({
  status: 'PASS',
  floors: floors.length,
  unique_biomes: new Set(floors.map(f => f.biome)).size,
  scarcity_sample: { floor1: d1, floor16: d16, floor100: d100 }
}, null, 2));
