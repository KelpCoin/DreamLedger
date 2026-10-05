'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { trendScore, rankOffers, STATES } = require('./TrendFlywheel');

test('missing evidence stays UNKNOWN', () => {
  const r=trendScore({});
  assert.equal(r.trend_state,'UNKNOWN');
  assert.equal(r.recommended_action,'OBSERVE');
  assert.equal(r.trend_score,null);
});

test('fresh accelerating demand can become HOT', () => {
  const r=trendScore({
    demand_signal_velocity:.95,
    demand_signal_volume:.85,
    buyer_intent_strength:.95,
    competition_density:.20,
    engagement_velocity:.90,
    search_interest_delta:.90,
    fulfillment_health:1,
    conversion_evidence:.90,
    age_days:1
  });
  assert.equal(r.trend_state,'HOT');
});

test('crowding suppresses an otherwise strong trend', () => {
  const r=trendScore({
    demand_signal_velocity:.80,
    demand_signal_volume:.80,
    buyer_intent_strength:.80,
    competition_density:.92,
    engagement_velocity:.80,
    search_interest_delta:.80,
    fulfillment_health:1,
    conversion_evidence:.20,
    age_days:2
  });
  assert.equal(r.trend_state,'OVERCROWDED');
});

test('dead trend can revive only with fresh positive evidence', () => {
  const r=trendScore({
    previous_state:'DEAD',
    demand_signal_velocity:.70,
    demand_signal_volume:.70,
    buyer_intent_strength:.70,
    competition_density:.20,
    engagement_velocity:.70,
    search_interest_delta:.70,
    fulfillment_health:1,
    conversion_evidence:.50,
    age_days:1
  });
  assert.equal(r.trend_state,'REVIVED');
});

test('rankOffers sorts known commercial momentum above unknown', () => {
  const r=rankOffers([
    {id:'unknown',trend:{}},
    {id:'hot',trend:{demand_signal_velocity:.9,buyer_intent_strength:.9,engagement_velocity:.9,search_interest_delta:.9,conversion_evidence:.8,fulfillment_health:1,age_days:1}}
  ]);
  assert.equal(r[0].id,'hot');
});

assert.equal(STATES.length,11);
