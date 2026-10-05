'use strict';

/**
 * DreamLedger Toll Nexus
 *
 * One paid composition over the existing Toll Road:
 * passport -> Elohim truth boundary -> Gauntlet decision -> Agent Bridge coordination
 * with room, seat, org-key, and capacity surfaces available as adjacent entitlements.
 *
 * This is the replacement name for the former Gold Button / Trinity presentation layer.
 * It does not create payment, buyer, settlement, or economic-truth facts.
 */

const { runTrinity } = require('./Trinity');

const SCHEMA = 'dreamledger/toll-nexus/v1';
const BUNDLE = [
  'agent-passport',
  'multi-agent-room',
  'capacity-futures',
  'seat-agent',
  'org-key'
];

function runNexus(input, meta) {
  const result = runTrinity(input || {}, meta || {});
  return {
    schema: SCHEMA,
    product: 'TOLL_NEXUS',
    display_name: 'Toll Nexus',
    former_presentation_name: 'Gold Button / Trinity',
    synergy: result.synergy,
    elohim: result.elohim,
    gauntlet: result.gauntlet,
    bridge: result.bridge,
    bundle_surfaces: BUNDLE,
    composition: 'passport_optional -> truth_foundry -> gauntlet_decision -> agent_bridge_coordination',
    adjacent_paid_roads: BUNDLE,
    economic_truth_unchanged: true,
    key_id: meta && meta.key_id ? meta.key_id : null,
    ran_at: result.ran_at,
    note: 'Toll Nexus composes existing evidence, decision, identity, coordination, room, capacity, seat, and org-key surfaces. Settlement remains the existing Toll Road boundary.'
  };
}

module.exports = { SCHEMA, BUNDLE, runNexus };
