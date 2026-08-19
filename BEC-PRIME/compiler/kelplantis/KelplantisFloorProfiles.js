'use strict';

const BIOMES = [
  ['verdant_ruins', 'bsp'],
  ['moss_caverns', 'caves'],
  ['obsidian_mine', 'bsp_with_caves'],
  ['fungal_depths', 'caves'],
  ['sunken_fortress', 'bsp'],
  ['ember_tunnels', 'caves'],
  ['crystal_warrens', 'graph'],
  ['thorned_catacombs', 'bsp_with_caves']
];

function floorProfile(floorId) {
  const id = Number(floorId);
  if (!Number.isInteger(id) || id < 1 || id > 100) throw new Error('floor_id must be an integer from 1 to 100');
  const [biome, style] = BIOMES[(id - 1) % BIOMES.length];
  return {
    floor_id: id,
    biome,
    generation_style: style,
    room_count: 18 + ((id * 7) % 9),
    enemy_density: id % 3 === 0 ? 'high' : id % 2 === 0 ? 'medium' : 'low',
    boss_arena_required: true,
    rest_room_required: true,
    secret_room_chance: 0.08 + ((id % 5) * 0.02),
    canonical_boss_id: `kelp_floor${id}_boss`,
    generation_version: '1'
  };
}

function allFloorProfiles() {
  return Array.from({ length: 100 }, (_, i) => floorProfile(i + 1));
}

module.exports = { floorProfile, allFloorProfiles };
