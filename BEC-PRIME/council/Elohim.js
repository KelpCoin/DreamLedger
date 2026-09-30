'use strict';

const sniper = require('../brain/SniperLoop');
const builder = require('../factory/BuilderBoss');
const firstSaleGate = require('../gauntlet/FirstSaleGate');
const elohimCreate = require('./ElohimCreate');

function run(input) {
  const config = Array.isArray(input) ? { products: input } : (input || {});
  const products = Array.isArray(config.products) ? config.products : (Array.isArray(input) ? input : []);
  const createdCandidates = elohimCreate.createCandidates(config.capabilities || [], config.demandSignals || []);
  const opportunities = sniper.run(products);
  const selected = opportunities.find(x => x.status === 'CANDIDATE') || null;
  const product = selected ? products.find(p => p.id === selected.source) : null;
  const gate = product ? firstSaleGate.check(product) : { verdict: 'FAIL', checks: { candidate_product: false }, reason: 'No candidate product selected.' };
  const approved = Boolean(selected && gate.verdict === 'PASS');
  const actionPack = approved ? builder.build(selected) : null;
  return {
    schema_version: 'BEC-ELOHIM-3.0',
    created_candidates: createdCandidates,
    creation_count: createdCandidates.length,
    verdict: approved ? 'SHIP_TO_BUYER_GATE' : 'KILL',
    breakdown: selected,
    path: approved ? ['ELOHIM_CREATE', 'SNIPER_LOOP', 'FIRST_SALE_GAUNTLET', 'BUILDER_BOSS', 'BUYER_INITIATED_CHECKOUT'] : ['ELOHIM_CREATE', 'SNIPER_LOOP', 'FIRST_SALE_GAUNTLET', 'KILL'],
    asset: product?.id || null,
    fossil_path: 'D:\\BrownEyeCortex\\Proof\\Fossils',
    '48hr_plan': approved ? ['Keep checkout buyer-initiated', 'Expose verified product surface', 'Wait for paid event', 'Seal Fossil on signed Stripe webhook'] : [],
    kill_condition: selected?.kill_condition || 'No viable payment path',
    gauntlet: gate,
    action_pack: actionPack
  };
}

module.exports = { run };
