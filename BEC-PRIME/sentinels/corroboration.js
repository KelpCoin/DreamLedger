#!/usr/bin/env node
'use strict';
/**
 * Corroborate DemandNotes + IntentNotes offline.
 * Air-gap safe: pure functions over local JSON arrays.
 * Does not touch Stripe. Does not claim revenue.
 */

const WEIGHT_D = {
  'D-VIEW': 1,
  'D-SEARCH': 2,
  'D-CLICK': 3,
  'D-SHARE': 4,
  'D-AGENT': 3,
  'D-RETURN': 4,
};

const WEIGHT_I = {
  'I-CHECKOUT_OPEN': 5,
  'I-CHECKOUT_ABANDON': 4,
  'I-PREFILL': 4,
  'I-RETURN_PAY': 6,
  'I-AGENT_HANDOFF': 5,
  'I-QUOTE_ACCEPT': 5,
};

function scoreDemand(notes) {
  return (notes || []).reduce((s, n) => s + (WEIGHT_D[n.signal] || 0), 0);
}

function scoreIntent(notes) {
  return (notes || []).reduce((s, n) => s + (WEIGHT_I[n.signal] || 0), 0);
}

/**
 * @param {object[]} demandNotes
 * @param {object[]} intentNotes
 * @param {string} [loopId]
 */
function corroborate(demandNotes, intentNotes, loopId) {
  const d = (demandNotes || []).filter((n) => !loopId || n.loop_id === loopId);
  const i = (intentNotes || []).filter((n) => !loopId || n.loop_id === loopId);
  const dScore = scoreDemand(d);
  const iScore = scoreIntent(i);
  let band = 'IDLE';
  if (dScore >= 6 && iScore >= 5) band = 'HOT';
  else if (iScore >= 5) band = 'INTENT_HEAVY';
  else if (dScore >= 6) band = 'DEMAND_HEAVY';
  else if (dScore + iScore > 0) band = 'WARM';

  return {
    schema: 'BEC-PRIME/SENTINEL-CORROBORATION/v1',
    loop_id: loopId || null,
    demand_score: dScore,
    intent_score: iScore,
    band,
    demand_count: d.length,
    intent_count: i.length,
    verified_revenue_implication: 'NONE',
    recommendation:
      band === 'HOT'
        ? 'Prioritise distribution and fulfilment readiness for this loop'
        : band === 'INTENT_HEAVY'
          ? 'Reduce friction on checkout path'
          : band === 'DEMAND_HEAVY'
            ? 'Improve offer clarity / Truth Oracle → CTA'
            : 'Do not invent activity',
  };
}

module.exports = { scoreDemand, scoreIntent, corroborate, WEIGHT_D, WEIGHT_I };

if (require.main === module) {
  const sample = corroborate(
    [{ signal: 'D-CLICK', loop_id: 'LOOP-BILLBOARD-FOUNDING-50' }],
    [{ signal: 'I-CHECKOUT_OPEN', loop_id: 'LOOP-BILLBOARD-FOUNDING-50' }],
    'LOOP-BILLBOARD-FOUNDING-50'
  );
  console.log(JSON.stringify(sample, null, 2));
}
