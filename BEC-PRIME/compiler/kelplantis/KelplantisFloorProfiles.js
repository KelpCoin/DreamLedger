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

/** Engineered scarcity: deeper floors → smaller towns, fewer homes, fewer billboards. */
function townEconomy(floorId) {
  const id = Number(floorId);
  const root = Math.sqrt(id);
  const town_plot_slots = Math.max(3, Math.ceil(48 / root));
  const town_map_size = Math.max(12, Math.ceil(40 / root));
  const home_grid = Math.max(2, Math.ceil(town_plot_slots / 4));
  const billboard_slots = Math.max(1, Math.ceil(town_plot_slots / 8));
  return {
    town_plot_slots,
    town_map_size,
    home_grid,
    billboard_slots,
    rent_cap_days: 30,
    max_owned_homes_soft_cap: 3,
    free_starter_plot_floor: 1,
    scarcity_formula: 'max(3, ceil(48/sqrt(floor))) plots; max(12, ceil(40/sqrt(floor))) map edge',
    commerce: {
      home_rent_offer_family: 'OFFER-KELP-HOME-RENT',
      home_buy_offer_family: 'OFFER-KELP-HOME-BUY',
      billboard_offer_family: 'OFFER-KELP-BILLBOARD',
      settlement: 'dreamledger_stripe_spine',
      revenue_rule: 'no_claim_without_stripe_proof'
    }
  };
}

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
    generation_version: '1',
    town_economy: townEconomy(id)
  };
}

function allFloorProfiles() {
  return Array.from({ length: 100 }, (_, i) => floorProfile(i + 1));
}

module.exports = { floorProfile, allFloorProfiles, townEconomy };
