'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { REQUIRED_FIELDS, createHoldRecord, evaluateHold, buildHoldLivenessMetrics, digestEffect } =
  require('../economic/OperationalHold');

const BASE_TIME = '2026-10-19T04:00:00.000Z';
const EFFECT = {
  offer_id: 'OFFER-CMD-DIAG-29-NZD',
  product_id: 'COMMANDER-DECK-DIAGNOSTIC-001',
  sku: 'CMD-DIAG-29',
  silo: 'mtg',
  amount_minor: 2900,
  currency: 'nzd',
  stripe_payment_link_url: null,
  fulfillment_route: '/buy/commander-deck-diagnostic-001/',
  delivery_contract: 'SIGNED_PAYMENT+REPORT_ARTIFACT+LEDGER_RECONCILIATION'
};

function hold(overrides = {}) {
  return createHoldRecord({
    material_parameters: EFFECT,
    reason_code: 'STRIPE_LINK_DRIFT',
    missing_dependency: 'EXACT_ACTIVE_LIVE_STRIPE_LINK_AND_DELIVERY_PROOF',
    owner: 'commerce-operations',
    created_at: BASE_TIME,
    expires_at: '2026-10-20T04:00:00.000Z',
    retry_policy: { mode: 'manual_after_dependency_refresh', max_attempts: 0, human_retry_required: true },
    permitted_next_transition: 'RECHECK_PROVIDER_AND_FULFILLMENT_EVIDENCE',
    ...overrides
  });
}

test('HOLD record has all seven operational contract fields and a stable material digest', () => {
  const record = hold();
  assert.ok(REQUIRED_FIELDS.every(key => Object.hasOwn(record, key)));
  assert.equal(record.effect_digest, digestEffect(EFFECT));
  assert.equal(record.state, 'HOLD');
  assert.equal(record.externalization_performed, false);
});

test('an unchanged offer with missing live evidence remains HOLD', () => {
  const record = hold();
  const result = evaluateHold(record, EFFECT, {
    now: '2026-10-19T05:00:00.000Z',
    transition: 'RECHECK_PROVIDER_AND_FULFILLMENT_EVIDENCE',
    dependencies_passed: false
  });
  assert.equal(result.decision, 'HOLD');
  assert.equal(result.reason_code, 'HUMAN_AUTHORIZATION_REQUIRED');
  assert.equal(result.externalization_performed, false);
});

test('amount drift between planning and execution refuses the old authority', () => {
  const record = hold();
  const changed = { ...EFFECT, amount_minor: 4900 };
  const result = evaluateHold(record, changed, { now: '2026-10-19T05:00:00.000Z' });
  assert.equal(result.decision, 'REFUSE');
  assert.equal(result.reason_code, 'EFFECT_MATERIAL_CHANGED_NEW_HOLD_AND_AUTHORITY_REQUIRED');
  assert.notEqual(result.new_effect_digest, record.effect_digest);
});

test('target, recipient, artifact and scope changes each change the effect digest', () => {
  for (const [key, value] of [
    ['product_id', 'ANOTHER-PRODUCT'],
    ['recipient_id', 'buyer-2'],
    ['artifact_id', 'report-v2'],
    ['scope', 'FULL_DECK_REBUILD']
  ]) {
    assert.notEqual(digestEffect(EFFECT), digestEffect({ ...EFFECT, [key]: value }), key);
  }
});

test('stale or revoked human authority cannot release a held effect', () => {
  const record = hold();
  const result = evaluateHold(record, EFFECT, {
    now: '2026-10-19T05:00:00.000Z',
    transition: 'RECHECK_PROVIDER_AND_FULFILLMENT_EVIDENCE',
    approval_status: 'REVOKED',
    approval_effect_digest: record.effect_digest,
    dependencies_passed: true
  });
  assert.equal(result.decision, 'REFUSE');
  assert.equal(result.reason_code, 'HUMAN_AUTHORITY_DENIED_OR_REVOKED');
});

test('release preflight requires exact digest-bound approval and dependency pass; it never externalizes', () => {
  const record = hold();
  const context = {
    now: '2026-10-19T05:00:00.000Z',
    transition: 'RECHECK_PROVIDER_AND_FULFILLMENT_EVIDENCE',
    approval_status: 'AUTHORIZED',
    approval_effect_digest: record.effect_digest,
    dependencies_passed: true
  };
  const accepted = evaluateHold(record, EFFECT, context);
  assert.equal(accepted.decision, 'ACCEPT');
  assert.equal(accepted.externalization_performed, false);
  assert.equal(record.state, 'HOLD', 'preflight must not mutate the persisted hold');

  const tampered = evaluateHold(record, EFFECT, { ...context, approval_effect_digest: 'sha256:wrong' });
  assert.equal(tampered.decision, 'REFUSE');
  assert.equal(tampered.reason_code, 'APPROVAL_NOT_BOUND_TO_EXACT_EFFECT_DIGEST');
});

test('expired hold and unpermitted transition are refused', () => {
  const record = hold();
  const expired = evaluateHold(record, EFFECT, {
    now: '2026-10-20T04:00:00.000Z',
    transition: 'RECHECK_PROVIDER_AND_FULFILLMENT_EVIDENCE'
  });
  assert.equal(expired.decision, 'REFUSE');
  assert.equal(expired.reason_code, 'HOLD_EXPIRED_NEW_REVIEW_REQUIRED');

  const wrongTransition = evaluateHold(record, EFFECT, {
    now: '2026-10-19T05:00:00.000Z',
    transition: 'EXECUTE_PAYMENT'
  });
  assert.equal(wrongTransition.decision, 'REFUSE');
  assert.equal(wrongTransition.reason_code, 'TRANSITION_NOT_PERMITTED');
});

test('liveness metrics distinguish real zero from unavailable evidence', () => {
  const record = hold();
  const unknown = buildHoldLivenessMetrics([record], null, '2026-10-19T05:00:00.000Z');
  assert.equal(unknown.active_hold_count, 1);
  assert.equal(unknown.oldest_active_hold_age_seconds, 3600);
  assert.equal(unknown.false_hold_rate, null);
  assert.equal(unknown.checkout_abandonment_rate, null);
  assert.equal(unknown.resolver_failure_count, null);
  assert.equal(unknown.unknowns_are_null_not_zero, true);

  const observed = buildHoldLivenessMetrics([record], [
    { type: 'HOLD_TERMINAL', outcome: 'FALSE_HOLD' },
    { type: 'HOLD_TERMINAL', outcome: 'TRUE_HOLD' },
    { type: 'CHECKOUT_ATTEMPT', outcome: 'ABANDONED' },
    { type: 'CHECKOUT_ATTEMPT', outcome: 'PAID_VERIFIED' },
    { type: 'RESOLVER_FAILURE' },
    { type: 'HOLD_DECISION', reason_code: 'EFFECT_MATERIAL_CHANGED_NEW_HOLD_AND_AUTHORITY_REQUIRED' },
    { type: 'HOLD_ESCALATION', started_at: BASE_TIME, resolved_at: '2026-10-19T04:05:00.000Z' }
  ], '2026-10-19T05:00:00.000Z');
  assert.equal(observed.false_hold_rate, 0.5);
  assert.equal(observed.checkout_abandonment_rate, 0.5);
  assert.equal(observed.resolver_failure_count, 1);
  assert.equal(observed.effect_drift_rejection_count, 1);
  assert.equal(observed.mean_escalation_latency_seconds, 300);
});
