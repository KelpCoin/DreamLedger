'use strict';

const assert = require('assert');
const { generateDungeon, hashSeed } = require('./KelplantisDungeonGenerator');

const input = { world_seed: 'kelplantis-mvp', floor_id: 1, canonical_boss_id: 'kelp_floor1_boss', floor_version: '1', room_count: 14 };
const a = generateDungeon(input);
const b = generateDungeon(input);
assert.deepStrictEqual(a, b, 'same seed inputs must generate identical dungeon');
assert.strictEqual(a.generation_seed, hashSeed('kelplantis-mvp', 1, 'kelp_floor1_boss', '1'));
assert.strictEqual(a.rooms.filter(r => r.tag === 'boss_arena').length, 1, 'exactly one boss arena required');
assert.strictEqual(a.boss_arena.canonical, true);
assert.ok(a.boss_arena.reachable_distance > 0, 'boss arena must be reachable from entrance');
assert.ok(a.corridors.length >= a.rooms.length - 1, 'MST must connect every room');
assert.ok(a.rooms.some(r => r.tag === 'entrance'));
assert.ok(a.rooms.some(r => r.tag === 'rest'));
assert.ok(a.rooms.some(r => r.tag === 'loot'));
assert.ok(a.rooms.some(r => r.tag === 'elite'));
assert.ok(a.populations.some(r => r.room_tag === 'boss_arena' && r.chest));
assert.ok(a.populations.some(r => r.room_tag === 'loot' && r.chest));
console.log(JSON.stringify({ status: 'PASS', deterministic: true, rooms: a.rooms.length, corridors: a.corridors.length, boss_arena: a.boss_arena }, null, 2));
