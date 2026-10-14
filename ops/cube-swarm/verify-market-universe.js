'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '../..');
const readJson = rel => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
const market = readJson('ops/cube-swarm/market-universe.contract.json');
const media = readJson('catalog/silos/media-music/implementation-contract.json');
const surfaces = readJson('public/surfaces.json');
const page = fs.readFileSync(path.join(root, 'public/media-music/index.html'), 'utf8');
const fail = [];
function check(name, fn) {
  try { fn(); console.log('PASS ' + name); }
  catch (err) { fail.push(name + ': ' + err.message); console.error('FAIL ' + name + ': ' + err.message); }
}

check('500000 business target is explicitly aspirational', () => {
  assert.equal(market.universe_targets.business_observations, 500000);
  assert.match(market.universe_targets.meaning, /not current coverage/i);
});
check('profit claims require sourced financial evidence', () => {
  assert.match(market.universe_targets.profitability_claim_policy, /traceable source/i);
  assert.equal(market.priority_model.score_type, 'EVIDENCE_BACKED_PRIORITY_NOT_PROFIT_FORECAST');
});
check('no synthetic opportunity or buyer admissions', () => {
  assert.equal(market.source_policy.rules.no_synthetic_observations, true);
  assert.equal(market.source_policy.rules.no_synthetic_buyers, true);
  assert.equal(market.source_policy.rules.no_synthetic_revenue, true);
  assert.equal(market.source_policy.rules.no_unauthorized_scraping, true);
});
check('revenue truth stays at zero in static baseline', () => {
  assert.equal(market.truth_invariants.verified_external_revenue_nzd, 0);
  assert.equal(market.truth_invariants.settled_external_payments, 0);
  assert.equal(market.truth_invariants.independent_external_buyers, 0);
  assert.equal(market.truth_invariants.first_sale_state, 'AWAITING_FIRST_REAL_BUYER');
});
check('media silo requires all four requested capabilities', () => {
  for (const key of ['forum_threads', 'realtime_chat', 'free_listings', 'paid_promotion']) {
    assert.equal(media.required_capabilities[key].required, true, key);
  }
});
check('paid promotion fails closed', () => {
  assert.equal(media.required_capabilities.paid_promotion.activation_allowed, false);
  assert.equal(media.required_capabilities.paid_promotion.current_state, 'HELD_NOT_END_TO_END_VERIFIED');
});
check('community/listing capability status is not falsely green', () => {
  for (const key of ['forum_threads', 'realtime_chat', 'free_listings']) {
    assert.equal(media.required_capabilities[key].current_state, 'NOT_VERIFIED', key);
  }
});
check('media route is registered in public surface directory', () => {
  assert.ok(surfaces.pages.some(p => p.path === '/media-music/' && p.name === 'Music & Media'));
});
check('page makes missing inventory explicit', () => {
  assert.match(page, /Verified inventory: not yet available/i);
  assert.match(page, /No sample products or fictitious seller stock/i);
});
check('page does not offer paid promotion checkout', () => {
  assert.match(page, /Paid promotion/i);
  assert.match(page, /will remain disabled/i);
  assert.doesNotMatch(page, /buy\.stripe\.com/i);
});
check('no external mutation is authorized by these contracts', () => {
  assert.ok(market.pipeline.some(x => x.stage === 'HUMAN_GATE'));
  assert.ok(market.source_policy.rules.no_external_publication);
  assert.ok(media.hard_gates.some(x => /Do not publish/i.test(x)));
});


const seedsA = readJson('ops/cube-swarm/opportunity-seeds.v1.json');
const seedsB = readJson('ops/cube-swarm/opportunity-seeds.501-1000.json');
const seedSet = [...seedsA.candidates, ...seedsB.candidates];
check('1,000 hypothesis seeds are contiguous and uniquely identified', () => {
  assert.equal(seedsA.count, 500);
  assert.equal(seedsB.count, 500);
  assert.equal(seedSet.length, 1000);
  assert.deepEqual(seedSet.map(x => x.ordinal), Array.from({length: 1000}, (_, i) => i + 1));
  assert.equal(new Set(seedSet.map(x => x.candidate_id)).size, 1000);
});
check('both seed ranges inherit human-review and manual-fulfillment gates', () => {
  for (const data of [seedsA, seedsB]) {
    assert.equal(data.human_and_economic_controls.applies_to_every_candidate, true);
    assert.equal(data.human_and_economic_controls.human_review_required, true);
    assert.equal(data.human_and_economic_controls.manual_fulfillment_required, true);
    assert.equal(data.human_and_economic_controls.settlement_must_be_independently_verified, true);
  }
});
check('no hypothesis is represented as a sale or verified profit', () => {
  for (const item of seedSet) {
    assert.equal(item.lifecycle, 'HYPOTHESIS_ONLY');
    assert.equal(item.evidence_status, 'UNVERIFIED');
    assert.equal(item.independent_buyer_verified, false);
    assert.equal(item.settled_payment_verified, false);
    assert.equal(item.fulfillment_verified, false);
    assert.equal(item.verified_revenue_nzd, 0);
    assert.equal(item.estimated_profit_nzd, null);
  }
});

if (fail.length) process.exitCode = 1;
else console.log('CUBE_MARKET_UNIVERSE_CONTRACT=PASS');
