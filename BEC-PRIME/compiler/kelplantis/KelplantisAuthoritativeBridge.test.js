'use strict';

const assert = require('assert');
const { RPC, createBridge } = require('./KelplantisAuthoritativeBridge');

for (const expected of [
  'createPlayer','getPlayer','getWorldState','getFloorGate','getFloorProgress','enterFloor',
  'movePlayer','talkToNpc','engageEncounter','attack','fleeEncounter','equipItem','listTownPresence'
]) assert.ok(RPC[expected], `missing RPC ${expected}`);

const offline = createBridge();
assert.strictEqual(offline.configured, false);
assert.strictEqual(createBridge({url:'https://x.supabase.co',anonKey:'PLACEHOLDER'}).configured, false);

const originalFetch = global.fetch;
global.fetch = async (url, options) => ({
  ok: true,
  status: 200,
  async json() { return { url, options }; },
});

(async () => {
  try {
    const bridge = createBridge({ url: 'https://example.supabase.co/', anonKey: 'publishable-test-key' });
    assert.strictEqual(bridge.configured, true);
    const result = await bridge.rpc(RPC.getFloorGate, { p_token: 'test-token', p_floor_id: 2 });
    assert.strictEqual(result.options.method, 'POST');
    assert.strictEqual(result.options.headers.apikey, 'publishable-test-key');
    assert.strictEqual(result.options.headers.Authorization, 'Bearer publishable-test-key');
    assert.strictEqual(result.url, 'https://example.supabase.co/rest/v1/rpc/kelplantis_get_floor_gate');
    await assert.rejects(() => bridge.rpc('not_a_kelplantis_rpc'), /Unsupported Kelplantis RPC/);
    console.log(JSON.stringify({ status: 'PASS', checks: 20, publishable_key_only: true }));
  } finally { global.fetch = originalFetch; }
})().catch(err => { console.error(err); process.exit(1); });
