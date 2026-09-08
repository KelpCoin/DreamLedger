'use strict';

/* Browser-safe transport only. Supabase owns game truth. */
const RPC = Object.freeze({
  createPlayer: 'kelplantis_create_player',
  getPlayer: 'kelplantis_get_player',
  getWorldState: 'kelplantis_get_world_state',
  getFloorGate: 'kelplantis_get_floor_gate',
  getFloorProgress: 'kelplantis_get_floor_progress',
  enterFloor: 'kelplantis_enter_floor',
  movePlayer: 'kelplantis_move_player',
  talkToNpc: 'kelplantis_talk_to_npc',
  engageEncounter: 'kelplantis_engage_encounter',
  attack: 'kelplantis_attack',
  fleeEncounter: 'kelplantis_flee_encounter',
  equipItem: 'kelplantis_equip_item',
  listTownPresence: 'kelplantis_list_town_presence',
});

function createBridge(config = {}) {
  const url = String(config.url || '').replace(/\/$/, '');
  const anonKey = String(config.anonKey || '');
  if (!url || !anonKey || anonKey.includes('PLACEHOLDER')) {
    return { configured: false, rpc: async () => { throw new Error('Kelplantis Supabase bridge is not configured.'); } };
  }
  async function rpc(name, args = {}) {
    if (!Object.values(RPC).includes(name)) throw new Error(`Unsupported Kelplantis RPC: ${name}`);
    const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
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
