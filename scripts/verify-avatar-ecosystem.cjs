'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const sourcePath = 'public/assets/avatar-identity.js';
const source = fs.readFileSync(path.join(root, sourcePath), 'utf8');
const storage = new Map();
const context = { localStorage: { getItem: k => storage.get(k), setItem: (k,v) => storage.set(k,v) }, dispatchEvent() {}, CustomEvent: function() {} };
context.window = context;
vm.runInNewContext(source, context, { filename: sourcePath });
const avatar = context.DreamLedgerAvatar;
const checks = [];
function check(name, fn) { fn(); checks.push({ name, status: 'PASS' }); }
check('catalogue identity is unique and every slot is supported', () => {
  const ids = avatar.COSMETIC_CATALOG.map(x => x.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const item of avatar.COSMETIC_CATALOG) assert.ok(Object.hasOwn(avatar.load().equipped, item.slot));
});
check('saved identity survives load and cross-surface export', () => {
  const state = avatar.load(); state.display_name = 'Regression fixture'; avatar.save(state);
  assert.equal(avatar.exportForSurface('web').display_name, 'Regression fixture');
  assert.equal(avatar.toPhinhavenLoadout().avatar_link.name, 'Regression fixture');
});
check('demo unlock and equip never create authoritative buffs', () => {
  avatar.own('neon-shades'); avatar.equip('neon-shades');
  const payload = avatar.toPhinhavenLoadout();
  assert.equal(payload.cosmetics[0].sku, 'neon-shades');
  assert.equal(payload.active_buffs.length, 0);
  assert.equal(payload.cosmetics[0].buff, null);
  assert.equal(payload.entitlement_verified, false);
  assert.equal(payload.authority, 'client-preview-only');
  assert.equal(payload.preview_buffs.length, 1);
});
check('tampered local equipment cannot promote ownership or wrong-slot effects', () => {
  const state = avatar.load(); state.equipped.feet = 'neon-shades'; state.equipped.back = 'founder-cloak'; avatar.save(state);
  assert.equal(avatar.toPhinhavenLoadout().cosmetics.length, 1);
  assert.equal(avatar.toPhinhavenLoadout().active_buffs.length, 0);
});
check('unsupported surfaces and malformed storage fail safely', () => {
  assert.throws(() => avatar.exportForSurface('adult'), /Unsupported/);
  storage.set(avatar.STORAGE_KEY, '{broken');
  assert.equal(avatar.load().owned.length, 0);
});
const out = path.resolve(process.env.AVATAR_PROOF_DIR || path.join(root, 'evidence/avatar-ecosystem'));
fs.mkdirSync(out, { recursive: true });
const sha256 = crypto.createHash('sha256').update(source).digest('hex');
fs.writeFileSync(path.join(out, 'gauntlet.json'), JSON.stringify({ schema: 'dreamledger/avatar-gauntlet/v1', status: 'PASS', source_sha256: sha256, checks, production_ready: false, limitations: ['Server entitlement integration and visual acceptance not verified'] }, null, 2));
fs.writeFileSync(path.join(out, 'factory-candidates.json'), JSON.stringify({ schema: 'dreamledger/avatar-factory-candidates/v1', source: sourcePath, source_sha256: sha256, status: 'DRAFT_REQUIRES_REFINEMENT', auto_publish: false, candidates: avatar.COSMETIC_CATALOG.map(item => ({ ...item, canonical_existing_id: item.id, readiness: 'PREVIEW_ONLY', required_gates: ['asset-provenance', 'visual-mobile-review', 'server-entitlement', 'bounded-server-effects', 'settlement-fulfillment'] })) }, null, 2));
console.log(JSON.stringify({ status: 'PASS', checks: checks.length, proof_directory: out }));
