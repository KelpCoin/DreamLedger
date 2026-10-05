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

  const velocity = clamp(input.demand_signal_velocity ?? 0);
  const volume = clamp(input.demand_signal_volume ?? 0);
  const intent = clamp(input.buyer_intent_strength ?? 0);
  const crowding = clamp(input.competition_density ?? 0);
  const engagement = clamp(input.engagement_velocity ?? 0);
  const searchDelta = clamp((Number(input.search_interest_delta ?? 0)+1)/2);
  const fulfillment = clamp(input.fulfillment_health ?? 0);
  const conversion = clamp(input.conversion_evidence ?? 0);
  const fresh = freshnessScore == null ? 0 : freshnessScore;

  const momentum = clamp(
    velocity*.28 + engagement*.16 + searchDelta*.16 + volume*.10 +
    intent*.15 + conversion*.15
  );

  const raw = clamp(
    momentum*.55 + intent*.12 + conversion*.10 + fulfillment*.08 +
    fresh*.15 - crowding*.22
  );

  let state;
  if (fresh < .10 && momentum < .20) state='UNKNOWN';
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
    const freshPositive = fresh > .55 && momentum > .48 && intent > .40;
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
