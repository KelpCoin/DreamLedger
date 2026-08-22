'use strict';

const sniper = require('../brain/SniperLoop');
const builder = require('../factory/BuilderBoss');
const firstSaleGate = require('../gauntlet/FirstSaleGate');

function run(input) {
  const products = Array.isArray(input) ? input : [input];
  const opportunities = sniper.run(products);
  const selected = opportunities.find(x => x.status === 'CANDIDATE') || null;
  const product = selected ? products.find(p => p.id === selected.source) : null;
  const gate = product ? firstSaleGate.check(product) : { verdict: 'FAIL', checks: { candidate_product: false }, reason: 'No candidate product selected.' };
  const approved = Boolean(selected && gate.verdict === 'PASS');
  const actionPack = approved ? builder.build(selected) : null;
  return {
    schema_version: 'BEC-ELOHIM-2.0',
    verdict: approved ? 'SHIP_TO_BUYER_GATE' : 'KILL',
    breakdown: selected,
    path: approved ? ['SNIPER_LOOP', 'FIRST_SALE_GAUNTLET', 'BUILDER_BOSS', 'BUYER_INITIATED_CHECKOUT'] : ['SNIPER_LOOP', 'FIRST_SALE_GAUNTLET', 'KILL'],
    asset: product?.id || null,
    fossil_path: 'D:\\BrownEyeCortex\\Proof\\Fossils',
    '48hr_plan': approved ? ['Keep checkout buyer-initiated', 'Expose verified product surface', 'Wait for paid event', 'Seal Fossil on signed Stripe webhook'] : [],
    kill_condition: selected?.kill_condition || 'No viable payment path',
    gauntlet: gate,
    action_pack: actionPack
  };
}

module.exports = { run };
