#!/usr/bin/env node
'use strict';
/**
 * Compile economic loop stubs from silo registry + approved offers.
 * Does NOT invent revenue. Does NOT enable checkout.
 * Writes BEC-PRIME/economic-loops/compiled/loop-stubs.json for agents and faces.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const REGISTRY_PATH = path.join(__dirname, 'registry.json');
const SILOS_PATH = path.join(ROOT, 'catalog', 'silos', 'CUBE-SILO-REGISTRY.json');
const APPROVED_PATH = path.join(ROOT, 'catalog', 'offers', 'approved.json');
const OUT_DIR = path.join(__dirname, 'compiled');
const OUT_PATH = path.join(OUT_DIR, 'loop-stubs.json');

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function main() {
  const registry = readJson(REGISTRY_PATH);
  const silos = readJson(SILOS_PATH);
  const approved = readJson(APPROVED_PATH);

  const live = (registry.loops || []).map((L) => ({
    loop_id: L.loop_id,
    source: 'registry_live',
    silo: L.silo,
    status: L.status,
    price_nzd: L.price_nzd,
    offer_id: L.offer_id,
    checkout_enabled: true,
    verified_revenue_nzd: L.verified_revenue_nzd || 0,
  }));

  const fromApproved = (approved.approved || [])
    .filter((o) => !(registry.loops || []).some((L) => L.offer_id === o.offer_id))
    .map((o) => ({
      loop_id: `LOOP-STUB-${o.offer_id}`,
      source: 'approved_offer',
      silo: o.silo,
      status: 'APPROVED_OFFER_NOT_YET_LOOP_REGISTERED',
      price_nzd: o.price,
      offer_id: o.offer_id,
      checkout_enabled: Boolean(o.payment_link_url),
      verified_revenue_nzd: 0,
    }));

  const siloSlots = (silos.silos || []).map((s) => ({
    loop_id: `LOOP-SLOT-${s.id.toUpperCase()}`,
    source: 'silo_registry',
    silo: s.id,
    status: 'EMPTY_SLOT',
    price_nzd: null,
    offer_id: null,
    checkout_enabled: false,
    verified_revenue_nzd: 0,
    note: 'New loops enter via candidate → gauntlet → approval → registry',
  }));

  const stubs = {
    schema: 'BEC-PRIME/LOOP-STUBS/v1',
    compiled_at: new Date().toISOString(),
    verified_external_revenue_nzd: registry.verified_external_revenue_nzd || 0,
    counts: {
      live: live.length,
      approved_unregistered: fromApproved.length,
      empty_silo_slots: siloSlots.length,
      total_stub_rows: live.length + fromApproved.length + siloSlots.length,
    },
    truth: {
      stubs_are_not_revenue: true,
      empty_slots_are_not_inventory: true,
      scale_requires_external_settlement: true,
    },
    loops: [...live, ...fromApproved, ...siloSlots],
  };

  stubs.content_sha256 = crypto
    .createHash('sha256')
    .update(JSON.stringify(stubs.loops))
    .digest('hex');

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(stubs, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({ wrote: OUT_PATH, counts: stubs.counts }, null, 2));
}

if (require.main === module) main();
module.exports = { main };
