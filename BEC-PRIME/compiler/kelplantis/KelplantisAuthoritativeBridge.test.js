'use strict';

const assert = require('assert');
const { RPC, createBridge } = require('./KelplantisAuthoritativeBridge');

assert.strictEqual(RPC.getWorldState, 'kelplantis_get_world_state');
assert.strictEqual(RPC.getFloorGate, 'kelplantis_get_floor_gate');
assert.strictEqual(RPC.enterFloor, 'kelplantis_enter_floor');
assert.strictEqual(RPC.attack, 'kelplantis_attack');

const offline = createBridge();
assert.strictEqual(offline.configured, false);

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
    console.log(JSON.stringify({ status: 'PASS', checks: 8 }));
  } finally {
    global.fetch = originalFetch;
  }
})().catch(err => { console.error(err); process.exit(1); });
