'use strict';

const assert = require('assert');
const { normalizeAppearance, catalog } = require('../routes/avatarCanonical');

const appearance = normalizeAppearance({ height: 99, build: -3, skin: 4 });
assert.deepStrictEqual(appearance, { height: 4, build: 0, skin: 4 });

const fallback = normalizeAppearance('not-json');
assert.deepStrictEqual(fallback, { height: 2, build: 2, skin: 5 });

const items = catalog();
assert.ok(Array.isArray(items), 'catalog must be an array');
assert.ok(items.length >= 1, 'catalog must contain at least one cosmetic');
assert.ok(items.every(item => item.id && item.item_id && item.slot), 'every cosmetic needs canonical identity and slot');
assert.strictEqual(items.find(item => item.id === 'free-cap').item_id, 'DRMZ-ITM-003');
assert.strictEqual(items.find(item => item.id === 'free-jacket').item_id, 'DRMZ-ITM-004');
assert.strictEqual(items.find(item => item.id === 'free-goldchain').item_id, 'DRMZ-ITM-005');

console.log(JSON.stringify({
  verdict: 'CANONICAL_AVATAR_UNIT_PASS',
  catalog_count: items.length,
  checks: ['appearance_normalization', 'malformed_appearance_fallback', 'catalog_identity', 'free_cosmetic_identity']
}, null, 2));
