'use strict';

const assert = require('assert');
const { canonicalGenerationRecord, appendHistoricalEvent } = require('./KelplantisHistory');

const original = canonicalGenerationRecord({ floor_id: 7, world_seed: 'world-a', canonical_boss_id: 'kelp_floor7_boss', generation_version: '1' });
const cleared = appendHistoricalEvent(original, { type: 'BOSS_CLEARED', at_utc: '2026-08-20T00:00:00.000Z' });
assert.strictEqual(original.generation_seed, cleared.generation_seed);
assert.strictEqual(cleared.historical_events.length, 1);
assert.strictEqual(cleared.canonical_boss_arena_locked, true);
const changed = canonicalGenerationRecord({ floor_id: 7, world_seed: 'world-b', canonical_boss_id: 'kelp_floor7_boss', generation_version: '1' });
assert.notStrictEqual(original.generation_seed, changed.generation_seed);
console.log(JSON.stringify({ status: 'PASS', irreversible_boss_history: true, deterministic_seed: true }, null, 2));
