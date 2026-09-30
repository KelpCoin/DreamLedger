'use strict';

const RUNG_NAMES = [
  'UNCLASSIFIED_INCOMPLETE_SOURCE',
  'PAIN_OBSERVED',
  'WORKAROUND_OBSERVED',
  'ECONOMIC_COST_OBSERVED',
  'SPENDING_OBSERVED',
  'PAYMENT_INTENT_OBSERVED',
  'COMMERCIAL_ACTION',
  'SETTLED_TRANSACTION',
  'FULFILLED_OUTCOME',
  'VERIFIED_ECONOMIC_OUTCOME'
];

function firstDefined(...values) {
  return values.find(v => v !== undefined && v !== null && String(v).trim() !== '');
}

function positiveAmount(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0;
}

function assessEconomicEvidence(seed = {}) {
  const e = seed.economic_evidence || seed.evidence || {};
  const sourceUrl = firstDefined(e.source_url, seed.source_url, seed.url);
  const sourceTimestamp = firstDefined(e.source_timestamp, seed.source_timestamp, seed.source_observed_at, seed.published, seed.timestamp);
  const exactQuote = firstDefined(e.exact_quote, seed.exact_quote);
  const authorHash = firstDefined(e.author_hash, seed.author_hash, e.author_id, seed.author_id);
  const workaround = firstDefined(e.workaround_description, seed.workaround_description);
  const costType = firstDefined(e.economic_cost_type, seed.economic_cost_type);
  const costAmount = firstDefined(e.economic_cost_amount, seed.economic_cost_amount);
  const costCurrency = firstDefined(e.economic_cost_currency, seed.economic_cost_currency);
  const costPeriod = firstDefined(e.economic_cost_period, seed.economic_cost_period);
  const spendAmount = firstDefined(e.current_spend_amount, seed.current_spend_amount);
  const spendCurrency = firstDefined(e.current_spend_currency, seed.current_spend_currency);
  const spendPeriod = firstDefined(e.current_spend_period, seed.current_spend_period);
  const spendSupplier = firstDefined(e.current_spend_supplier, seed.current_spend_supplier);
  const paymentIntentType = firstDefined(e.payment_intent_type, seed.payment_intent_type);
  const paymentIntentSource = firstDefined(e.payment_intent_source, seed.payment_intent_source);
  const commercialActionType = firstDefined(e.commercial_action_type, seed.commercial_action_type);
  const commercialActionRef = firstDefined(e.commercial_action_reference, seed.commercial_action_reference);
  const settled = e.settlement || seed.settlement || {};
  const independentBuyer = settled.independent_buyer === true || e.independent_buyer === true || seed.independent_buyer === true;
  const settlementReference = firstDefined(settled.settlement_reference, e.settlement_reference, seed.settlement_reference);
  const attributionId = firstDefined(settled.attribution_id, e.attribution_id, seed.attribution_id);
  const amountReceived = firstDefined(settled.amount_received, e.amount_received, seed.amount_received);
  const fulfillment = e.fulfillment || seed.fulfillment || {};
  const artifactRef = firstDefined(fulfillment.artifact_ref, e.artifact_ref, seed.artifact_ref);
  const deliveryEvidence = firstDefined(fulfillment.delivery_confirmation, fulfillment.delivery_evidence, e.delivery_confirmation, seed.delivery_confirmation);
  const independentEvidence = firstDefined(e.independent_evidence_ref, seed.independent_evidence_ref);
  const truthVerified = e.truth_oracle_verified === true || seed.truth_oracle_verified === true;

  const checks = [
    Boolean(sourceUrl && sourceTimestamp && exactQuote && authorHash),
    Boolean(workaround),
    Boolean(costType && positiveAmount(costAmount) && costCurrency && costPeriod),
    Boolean(positiveAmount(spendAmount) && spendCurrency && spendPeriod && spendSupplier),
    Boolean(paymentIntentType && paymentIntentSource),
    Boolean(commercialActionType && commercialActionRef),
    Boolean(independentBuyer && settlementReference && attributionId && positiveAmount(amountReceived)),
    Boolean(artifactRef && deliveryEvidence),
    Boolean(independentEvidence && truthVerified)
  ];

  let evidenceRung = 0;
  while (evidenceRung < checks.length && checks[evidenceRung]) evidenceRung += 1;

  const missingByRung = [
    ['source_url', 'source_timestamp', 'exact_quote', 'author_hash'],
    ['workaround_description'],
    ['economic_cost_type', 'economic_cost_amount', 'economic_cost_currency', 'economic_cost_period'],
    ['current_spend_amount', 'current_spend_currency', 'current_spend_period', 'current_spend_supplier'],
    ['payment_intent_type', 'payment_intent_source'],
    ['commercial_action_type', 'commercial_action_reference'],
    ['independent_buyer=true', 'settlement_reference', 'attribution_id', 'amount_received'],
    ['artifact_ref', 'delivery_confirmation_or_delivery_evidence'],
    ['independent_evidence_ref', 'truth_oracle_verified=true']
  ];

  return {
    schema: 'DREAMLEDGER/ECONOMIC-EVIDENCE-LADDER/v1',
    evidence_rung: evidenceRung,
    rung_name: RUNG_NAMES[evidenceRung],
    next_rung: evidenceRung < 9 ? RUNG_NAMES[evidenceRung + 1] : null,
    status: evidenceRung === 9 ? 'VERIFIED' : evidenceRung === 0 ? 'INCOMPLETE_SOURCE' : 'OBSERVED_NOT_PROMOTED',
    missing_requirements: evidenceRung < 9 ? missingByRung[evidenceRung] : [],
    source_url: sourceUrl || null,
    source_timestamp: sourceTimestamp || null,
    exact_quote_present: Boolean(exactQuote),
    author_hash_present: Boolean(authorHash),
    recurrence_key: firstDefined(e.pain_category, seed.pain_category, e.recurrence_key, seed.recurrence_key) || null,
    recurrence_count: Number.isInteger(e.recurrence_count) && e.recurrence_count >= 0
      ? e.recurrence_count
      : Number.isInteger(seed.recurrence_count) && seed.recurrence_count >= 0
        ? seed.recurrence_count
        : null,
    commercial_evidence_status: evidenceRung >= 5 ? 'COMMERCIAL_EVIDENCE_OBSERVED' : 'NOT_ESTABLISHED',
    revenue_status: evidenceRung >= 7 ? 'SETTLEMENT_EVIDENCE_COMPLETE' : 'NOT_ESTABLISHED',
    verified_outcome_status: evidenceRung === 9 ? 'VERIFIED_ECONOMIC_OUTCOME' : 'NOT_ESTABLISHED',
    replication_eligible: evidenceRung === 9
  };
}

function summarizeEvidenceLadder(records = []) {
  const counts = Object.fromEntries(RUNG_NAMES.map((name, rung) => [name, 0]));
  const recurrence = {};
  for (const record of records) {
    const assessment = record && record.schema === 'DREAMLEDGER/ECONOMIC-EVIDENCE-LADDER/v1'
      ? record
      : assessEconomicEvidence(record || {});
    counts[assessment.rung_name] = (counts[assessment.rung_name] || 0) + 1;
    if (assessment.recurrence_key) {
      recurrence[assessment.recurrence_key] = (recurrence[assessment.recurrence_key] || 0) + 1;
    }
  }
  return {
    schema: 'DREAMLEDGER/ECONOMIC-EVIDENCE-LADDER-SUMMARY/v1',
    input_count: records.length,
    rung_counts: counts,
    recurrence_counts: recurrence,
    rule: 'Only sequentially complete evidence advances the rung; pain, commercial activity, settlement, fulfillment, and verified outcomes are not interchangeable.',
    verified_economic_outcomes: counts.VERIFIED_ECONOMIC_OUTCOME || 0,
    replication_eligible_count: records.filter(record => {
      const a = record && record.schema === 'DREAMLEDGER/ECONOMIC-EVIDENCE-LADDER/v1'
        ? record
        : assessEconomicEvidence(record || {});
      return a.replication_eligible === true;
    }).length
  };
}

module.exports = { RUNG_NAMES, assessEconomicEvidence, summarizeEvidenceLadder };
