'use strict';

const STATES = Object.freeze([
  'UNKNOWN','HEATING_UP','ON_RISE','HOT','CROWDED','OVERCROWDED',
  'DYING','DEAD','HATED','MISSED','REVIVED'
]);

const clamp = (n,min=0,max=1) => Math.max(min,Math.min(max,Number.isFinite(n)?n:min));
const num = v => Number.isFinite(Number(v)) ? Number(v) : null;

function freshness(ageDays, halfLifeDays=14){
  const age=num(ageDays);
  if(age===null || age<0) return null;
  return Math.exp(-Math.log(2)*age/halfLifeDays);
}

function trendScore(input={}){
  const freshnessScore = input.freshness == null
    ? freshness(input.age_days, input.half_life_days || 14)
    : clamp(input.freshness);

  const known = [
    input.demand_signal_velocity,
    input.demand_signal_volume,
    input.buyer_intent_strength,
    input.competition_density,
    input.engagement_velocity,
    input.search_interest_delta,
    input.fulfillment_health,
    input.conversion_evidence,
    freshnessScore
  ].filter(v => Number.isFinite(Number(v)));

  if (!known.length) {
    return {
      trend_state:'UNKNOWN',
      trend_score:null,
      confidence:0,
      momentum:0,
      crowding:null,
      freshness:null,
      recommended_action:'OBSERVE'
    };
  }

  const velocity = input.demand_signal_velocity == null ? null : clamp(input.demand_signal_velocity);
  const volume = input.demand_signal_volume == null ? null : clamp(input.demand_signal_volume);
  const intent = input.buyer_intent_strength == null ? null : clamp(input.buyer_intent_strength);
  const crowding = input.competition_density == null ? 0 : clamp(input.competition_density);
  const engagement = input.engagement_velocity == null ? null : clamp(input.engagement_velocity);
  const searchDelta = input.search_interest_delta == null ? null : clamp((Number(input.search_interest_delta)+1)/2);
  const fulfillment = input.fulfillment_health == null ? null : clamp(input.fulfillment_health);
  const conversion = input.conversion_evidence == null ? null : clamp(input.conversion_evidence);
  const fresh = freshnessScore == null ? 0 : freshnessScore;

  const momentum =
    (velocity == null ? 0 : velocity*.28) +
    (engagement == null ? 0 : engagement*.16) +
    (searchDelta == null ? 0 : searchDelta*.16) +
    (volume == null ? 0 : volume*.10) +
    (intent == null ? 0 : intent*.15) +
    (conversion == null ? 0 : conversion*.15);

  const directionalDepth = [velocity, volume, intent, engagement, searchDelta, conversion]
    .filter(v => v != null).length;

  const raw = clamp(
    momentum*.55 +
    (intent == null ? 0 : intent*.12) +
    (conversion == null ? 0 : conversion*.10) +
    (fulfillment == null ? 0 : fulfillment*.08) +
    fresh*.15 - crowding*.22
  );

  let state;
  if (fresh < .10 && momentum < .20) state='UNKNOWN';
  else if (directionalDepth < 2) state='UNKNOWN';
  else if (conversion > .75 && momentum > .72 && crowding < .55) state='HOT';
  else if (momentum > .68 && crowding >= .55 && crowding < .78) state='CROWDED';
  else if (momentum > .58 && crowding >= .78) state='OVERCROWDED';
  else if (momentum > .58) state='ON_RISE';
  else if (momentum > .43) state='HEATING_UP';
  else if (momentum < .18 && fresh < .25) state='DEAD';
  else if (momentum < .25 && crowding > .70) state='HATED';
  else if (momentum < .30) state='DYING';
  else if (momentum < .36) state='MISSED';
  else state='HEATING_UP';

  if (state === 'DEAD' || state === 'HATED' || state === 'MISSED') {
    const prior = String(input.previous_state || '');
    const freshPositive = fresh > .55 && momentum > .48 && (intent == null || intent > .40);
    if (freshPositive && prior !== 'UNKNOWN') state='REVIVED';
  }

  const confidence = clamp(
    (known.length / 9) * .55 + fresh*.25 + Math.min(1,Math.abs(momentum-.5)*2)*.20
  );

  const actions = {
    UNKNOWN:'OBSERVE',
    HEATING_UP:'PROMOTE_CANDIDATE',
    ON_RISE:'PROMOTE',
    HOT:'FEATURE',
    CROWDED:'DEFEND_OR_DIFFERENTIATE',
    OVERCROWDED:'DEPRIORITIZE',
    DYING:'REDUCE_EXPOSURE',
    DEAD:'QUARANTINE',
    HATED:'QUARANTINE',
    MISSED:'RETEST_IF_NEW_SIGNAL',
    REVIVED:'RETEST_AND_FEATURE'
  };

  return {
    trend_state:state,
    trend_score:Number(raw.toFixed(4)),
    confidence:Number(confidence.toFixed(4)),
    momentum:Number(momentum.toFixed(4)),
    crowding:Number(crowding.toFixed(4)),
    freshness:freshnessScore==null?null:Number(freshnessScore.toFixed(4)),
    recommended_action:actions[state]
  };
}

function rankOffers(items=[]){
  return [...items]
    .map(item => ({...item, trend:trendScore(item.trend || item)}))
    .sort((a,b) => (b.trend.trend_score ?? -1) - (a.trend.trend_score ?? -1));
}

module.exports = { STATES, freshness, trendScore, rankOffers };
