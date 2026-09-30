'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { assessEconomicEvidence, summarizeEvidenceLadder, isActionableBuyerSignal, hasExplicitPaymentIntent } = require('./EconomicEvidenceLadder');

test('public radar candidate without verbatim quote and author hash does not become sourced pain evidence', () => {
  const result = assessEconomicEvidence({
    url: 'https://example.test/post/1',
    source_observed_at: '2026-09-30',
    observed_problem: 'A person asks for help'
  });
  assert.equal(result.evidence_rung, 0);
  assert.equal(result.rung_name, 'UNCLASSIFIED_INCOMPLETE_SOURCE');
  assert.equal(result.replication_eligible, false);
  assert.deepEqual(result.missing_requirements, ['source_url', 'source_timestamp', 'exact_quote', 'author_hash', 'first_person_complaint=true']);
});

test('full nine-rung evidence chain qualifies only with all required evidence', () => {
  const result = assessEconomicEvidence({
    economic_evidence: {
      source_url: 'https://example.test/post/1',
      source_timestamp: '2026-09-01T12:00:00Z',
      exact_quote: 'I spend ten hours each month fixing this manually.',
      author_hash: 'sha256:person-1',
      first_person_complaint: true,
      first_person_complaint: true,
      workaround_description: 'Maintains a spreadsheet and manually reconciles rows.',
      economic_cost_type: 'LABOUR_TIME',
      economic_cost_amount: 10,
      economic_cost_currency: 'HOURS',
      economic_cost_period: 'MONTH',
      current_spend_amount: 800,
      current_spend_currency: 'NZD',
      current_spend_period: 'MONTH',
      current_spend_supplier: 'Existing supplier',
      payment_intent_type: 'QUOTE_REQUEST',
      payment_intent_source: 'https://example.test/quote-request/1',
      commercial_action_type: 'QUOTE_ISSUED',
      commercial_action_reference: 'QUOTE-001',
      settlement: {
        independent_buyer: true,
        settlement_reference: 'SETTLED-001',
        attribution_id: 'ATTR-001',
        amount_received: 49
      },
      fulfillment: {
        artifact_ref: 'artifact://brief-001',
        delivery_confirmation: 'customer-confirmed-receipt'
      },
      independent_evidence_ref: 'evidence://independent-001',
      truth_oracle_verified: true,
      pain_category: 'PROCUREMENT_MANUAL_RECONCILIATION'
    }
  });
  assert.equal(result.evidence_rung, 9);
  assert.equal(result.rung_name, 'VERIFIED_ECONOMIC_OUTCOME');
  assert.equal(result.replication_eligible, true);
  assert.equal(result.commercial_evidence_status, 'COMMERCIAL_EVIDENCE_OBSERVED');
  assert.equal(result.revenue_status, 'SETTLEMENT_EVIDENCE_COMPLETE');
});

test('a gap blocks rung promotion rather than skipping missing prerequisites', () => {
  const result = assessEconomicEvidence({
    economic_evidence: {
      source_url: 'https://example.test/post/1',
      source_timestamp: '2026-09-01T12:00:00Z',
      exact_quote: 'I spend ten hours each month fixing this manually.',
      author_hash: 'sha256:person-1',
      workaround_description: 'Manual spreadsheet',
      economic_cost_type: 'LABOUR_TIME',
      economic_cost_amount: 10,
      economic_cost_currency: 'HOURS',
      economic_cost_period: 'MONTH',
      current_spend_amount: 800,
      current_spend_currency: 'NZD',
      current_spend_period: 'MONTH',
      current_spend_supplier: 'Existing supplier',
      commercial_action_type: 'QUOTE_ISSUED',
      commercial_action_reference: 'QUOTE-001'
    }
  });
  assert.equal(result.evidence_rung, 4);
  assert.equal(result.rung_name, 'SPENDING_OBSERVED');
  assert.deepEqual(result.missing_requirements, ['payment_intent_type', 'payment_intent_source']);
});

test('recurrence summary counts only explicitly keyed pain categories', () => {
  const summary = summarizeEvidenceLadder([
    { pain_category: 'PROCUREMENT', url: 'https://example.test/1', exact_quote: 'quote', source_timestamp: '2026-09-01', author_hash: 'a' },
    { pain_category: 'PROCUREMENT', url: 'https://example.test/2', exact_quote: 'quote', source_timestamp: '2026-09-02', author_hash: 'b' },
    { url: 'https://example.test/3', exact_quote: 'quote', source_timestamp: '2026-09-03', author_hash: 'c' }
  ]);
  assert.equal(summary.input_count, 3);
  assert.equal(summary.recurrence_counts.PROCUREMENT, 2);
  assert.equal(summary.verified_economic_outcomes, 0);
});

test('buyer action is blocked without rung-one evidence and verified surface permission', () => {
  const candidate = {
    url: 'https://example.test/post/1',
    source_observed_at: '2026-09-30',
    observed_problem: 'A person asks for help',
    permission: 'UNVERIFIED_SURFACE_RULES'
  };
  assert.equal(isActionableBuyerSignal(candidate), false);
  candidate.exact_quote = 'I need help comparing these quotes.';
  candidate.author_hash = 'sha256:author';
  candidate.first_person_complaint = true;
  candidate.permission = 'UNVERIFIED_SURFACE_RULES';
  assert.equal(isActionableBuyerSignal(candidate), false);
  candidate.permission = 'VERIFIED_PERMITTED';
  assert.equal(isActionableBuyerSignal(candidate), true);
});

test('a workaround or industry observation cannot be promoted to pain rung without first-person complaint classification', () => {
  const result = assessEconomicEvidence({
    economic_evidence: {
      source_url: 'https://example.test/thread/comment',
      source_timestamp: '2026-09-02T08:49:16Z',
      exact_quote: 'I have seen procurement teams manually compare quotes.',
      author_hash: 'sha256:observer',
      first_person_complaint: false,
      workaround_description: 'Quotes are compared manually in spreadsheets.'
    }
  });
  assert.equal(result.evidence_rung, 0);
  assert.equal(result.rung_name, 'UNCLASSIFIED_INCOMPLETE_SOURCE');
  assert.equal(result.first_person_complaint, false);
});

test('mentioning price or budget is not payment intent without an explicit sourced event', () => {
  assert.equal(hasExplicitPaymentIntent({title:'What is the price?', body:'We have a budget of $49.'}), false);
  assert.equal(hasExplicitPaymentIntent({economic_evidence:{payment_intent_type:'QUOTE_REQUEST',payment_intent_source:'https://example.test/quote'}}), true);
});
