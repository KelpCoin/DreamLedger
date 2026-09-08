'use strict';

/*
 * Browser-safe, publishable-key-only bridge contract for Kelplantis.
 * No service-role secret belongs in the generated client.
 * The bridge is intentionally transport-only: game rules remain authoritative in Supabase RPCs.
 */

const RPC = Object.freeze({
  getPlayer: 'kelplantis_get_player',
  getWorldState: 'kelplantis_get_world_state',
  getFloorGate: 'kelplantis_get_floor_gate',
  enterFloor: 'kelplantis_enter_floor',
  talkToNpc: 'kelplantis_talk_to_npc',
  attack: 'kelplantis_attack',
});

function createBridge(config = {}) {
  const url = String(config.url || '').replace(/\/$/, '');
  const anonKey = String(config.anonKey || '');
  if (!url || !anonKey) {
    return { configured: false, rpc: async () => { throw new Error('Kelplantis Supabase bridge is not configured.'); } };
  }

  async function rpc(name, args = {}) {
    if (!Object.values(RPC).includes(name)) throw new Error(`Unsupported Kelplantis RPC: ${name}`);
    const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args),
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Kelplantis RPC ${name} failed (${response.status}): ${detail}`);
    }
    return response.json();
  }

  return { configured: true, rpc };
}

module.exports = { RPC, createBridge };
