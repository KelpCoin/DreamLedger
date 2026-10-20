'use strict';

const crypto = require('node:crypto');

const SCHEMA = 'DREAMLEDGER/OPERATIONAL-HOLD/v1';
const REQUIRED_FIELDS = [
  'effect_digest',
  'reason_code',
  'missing_dependency',
  'owner',
  'expires_at',
  'retry_policy',
  'permitted_next_transition'
];

function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      if (value[key] !== undefined) out[key] = normalize(value[key]);
    }
    return out;
  }
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new Error('HOLD_MATERIAL_NUMBER_MUST_BE_FINITE');
  }
  return value;
}

function stableStringify(value) {
  return JSON.stringify(normalize(value));
}

function canonicalEffectPayload(materialParameters, blobs = {}) {
  if (!materialParameters || typeof materialParameters !== 'object' || Array.isArray(materialParameters)) {
    throw new Error('HOLD_EFFECT_MATERIAL_MUST_BE_AN_OBJECT');
  }
  if (!blobs || typeof blobs !== 'object' || Array.isArray(blobs)) {
    throw new Error('HOLD_EFFECT_BLOBS_MUST_BE_AN_OBJECT');
  }
  return { record: normalize(materialParameters), blobs: normalize(blobs) };
}

function digestEffect(materialParameters, blobs = {}) {
  return 'sha256:' + crypto.createHash('sha256')
    .update(stableStringify(canonicalEffectPayload(materialParameters, blobs)), 'utf8')
    .digest('hex');
}

function iso(value, code) {
  const time = new Date(value);
  if (!Number.isFinite(time.getTime())) throw new Error(code || 'HOLD_TIMESTAMP_INVALID');
  return time.toISOString();
}

function createHoldRecord(input = {}) {
  const effect = normalize(input.material_parameters || input.effect);
  if (!effect || typeof effect !== 'object' || Array.isArray(effect) || !Object.keys(effect).length) {
    throw new Error('HOLD_MATERIAL_PARAMETERS_REQUIRED');
  }

  const createdAt = iso(input.created_at || input.now || new Date().toISOString(), 'HOLD_CREATED_AT_INVALID');
  const expiresAt = iso(input.expires_at, 'HOLD_EXPIRES_AT_INVALID');
  if (Date.parse(expiresAt) <= Date.parse(createdAt)) throw new Error('HOLD_EXPIRY_MUST_FOLLOW_CREATION');

  const reasonCode = String(input.reason_code || '').trim();
  const missingDependency = String(input.missing_dependency || '').trim();
  const owner = String(input.owner || '').trim();
  const permitted = String(input.permitted_next_transition || '').trim();
  if (!reasonCode) throw new Error('HOLD_REASON_CODE_REQUIRED');
  if (!missingDependency) throw new Error('HOLD_MISSING_DEPENDENCY_REQUIRED');
  if (!owner) throw new Error('HOLD_OWNER_REQUIRED');
  if (!permitted) throw new Error('HOLD_PERMITTED_TRANSITION_REQUIRED');

  const retryInput = input.retry_policy && typeof input.retry_policy === 'object' ? input.retry_policy : {};
  const retryPolicy = {
    mode: String(retryInput.mode || 'manual_after_dependency_refresh'),
    max_attempts: Number.isInteger(retryInput.max_attempts) && retryInput.max_attempts >= 0
      ? retryInput.max_attempts
      : 0,
    retry_not_before: retryInput.retry_not_before ? iso(retryInput.retry_not_before, 'HOLD_RETRY_TIMESTAMP_INVALID') : null,
    human_retry_required: retryInput.human_retry_required !== false
  };

  const blobs = normalize(input.blobs || {});
  const effectDigest = digestEffect(effect, blobs);
  return {
    schema: SCHEMA,
    hold_id: 'HOLD-' + effectDigest.slice(7, 23).toUpperCase(),
    state: 'HOLD',
    material_parameters: effect,
    blobs,
    effect_digest: effectDigest,
    reason_code: reasonCode,
    missing_dependency: missingDependency,
    owner,
    created_at: createdAt,
    expires_at: expiresAt,
    retry_policy: retryPolicy,
    permitted_next_transition: permitted,
    transition_history: [{
      decision: 'HOLD',
      at: createdAt,
      reason_code: reasonCode,
      effect_digest: effectDigest
    }],
    externalization_performed: false
  };
}

function evaluateHold(record, currentMaterialParameters, context = {}) {
  const now = iso(context.now || new Date().toISOString(), 'HOLD_EVALUATION_TIME_INVALID');
  const result = (decision, reasonCode, details = {}) => ({
    decision,
    reason_code: reasonCode,
    hold_id: record && record.hold_id || null,
    effect_digest: record && record.effect_digest || null,
    current_effect_digest: currentMaterialParameters && typeof currentMaterialParameters === 'object'
      ? digestEffect(currentMaterialParameters, context.blobs === undefined ? {} : context.blobs)
      : null,
    evaluated_at: now,
    externalization_performed: false,
    ...details
  });

  if (!record || record.schema !== SCHEMA || !REQUIRED_FIELDS.every(key => record[key] !== undefined && record[key] !== null)) {
    return result('REFUSE', 'HOLD_RECORD_INCOMPLETE_OR_UNKNOWN_SCHEMA');
  }
  if (record.state !== 'HOLD') return result('REFUSE', 'HOLD_NOT_ACTIVE');
  const storedBlobs = record.blobs === undefined ? {} : record.blobs;
  if (digestEffect(record.material_parameters, storedBlobs) !== record.effect_digest) {
    return result('REFUSE', 'HOLD_RECORD_TAMPERED');
  }

  let currentDigest;
  try {
    currentDigest = digestEffect(currentMaterialParameters, context.blobs === undefined ? {} : context.blobs);
  } catch (_) {
    return result('REFUSE', 'CURRENT_EFFECT_MATERIAL_INVALID');
  }
  if (currentDigest !== record.effect_digest) {
    return result('REFUSE', 'EFFECT_MATERIAL_CHANGED_NEW_HOLD_AND_AUTHORITY_REQUIRED', {
      new_effect_digest: currentDigest
    });
  }
  if (Date.parse(now) >= Date.parse(record.expires_at)) return result('REFUSE', 'HOLD_EXPIRED_NEW_REVIEW_REQUIRED');
  if (String(context.transition || '') !== record.permitted_next_transition) {
    return result('REFUSE', 'TRANSITION_NOT_PERMITTED');
  }
  if (context.approval_status === 'DENIED' || context.approval_status === 'REVOKED') {
    return result('REFUSE', 'HUMAN_AUTHORITY_DENIED_OR_REVOKED');
  }
  if (context.approval_status !== 'AUTHORIZED') {
    return result('HOLD', 'HUMAN_AUTHORIZATION_REQUIRED');
  }
  if (context.approval_effect_digest !== record.effect_digest) {
    return result('REFUSE', 'APPROVAL_NOT_BOUND_TO_EXACT_EFFECT_DIGEST');
  }
  if (context.dependencies_passed !== true) {
    return result('HOLD', 'DEPENDENCY_EVIDENCE_INCOMPLETE');
  }
  return result('ACCEPT', 'PREFLIGHT_ACCEPTED_NO_EXTERNAL_ACTION', {
    release_class: 'ORDINARY',
    permitted_next_transition: record.permitted_next_transition
  });
}

function evaluateExceptionalRelease(record, currentMaterialParameters, exception = {}, context = {}) {
  const now = iso(context.now || new Date().toISOString(), 'HOLD_EVALUATION_TIME_INVALID');
  const deny = (reasonCode, details = {}) => ({
    decision: 'REFUSE',
    release_class: 'EXCEPTIONAL',
    reason_code: reasonCode,
    hold_id: record && record.hold_id || null,
    effect_digest: record && record.effect_digest || null,
    externalization_performed: false,
    evaluated_at: now,
    ...details
  });
  if (!record || record.schema !== SCHEMA || record.state !== 'HOLD' ||
      !REQUIRED_FIELDS.every(key => record[key] !== undefined && record[key] !== null)) {
    return deny('HOLD_RECORD_INCOMPLETE_OR_NOT_ACTIVE');
  }
  const blobs = context.blobs === undefined ? {} : context.blobs;
  let currentDigest;
  try {
    if (digestEffect(record.material_parameters, record.blobs === undefined ? {} : record.blobs) !== record.effect_digest) {
      return deny('HOLD_RECORD_TAMPERED');
    }
    currentDigest = digestEffect(currentMaterialParameters, blobs);
  } catch (_) {
    return deny('CURRENT_EFFECT_MATERIAL_INVALID');
  }
  if (currentDigest !== record.effect_digest ||
      exception.effect_digest !== record.effect_digest ||
      exception.approval_effect_digest !== record.effect_digest) {
    return deny('EXCEPTION_NOT_BOUND_TO_EXACT_EFFECT_DIGEST', { current_effect_digest: currentDigest });
  }
  if (context.transition !== record.permitted_next_transition) return deny('TRANSITION_NOT_PERMITTED');
  if (exception.type !== 'EXCEPTIONAL_RELEASE' || !String(exception.exception_id || '').trim()) {
    return deny('EXCEPTION_RECORD_REQUIRED');
  }
  if (exception.approval_status !== 'AUTHORIZED' || !String(exception.authorized_by || '').trim()) {
    return deny('EXCEPTION_AUTHORITY_REQUIRED');
  }
  if (!String(exception.reason_code || '').trim() ||
      String(exception.waived_dependency || '') !== record.missing_dependency) {
    return deny('EXCEPTION_MUST_NAME_THE_HELD_DEPENDENCY');
  }
  if (!exception.scope || exception.scope.effect_digest !== record.effect_digest ||
      exception.scope.transition !== record.permitted_next_transition) {
    return deny('EXCEPTION_SCOPE_NOT_BOUND_TO_HELD_EFFECT');
  }
  let expiry;
  try { expiry = Date.parse(iso(exception.expires_at, 'EXCEPTION_EXPIRY_INVALID')); }
  catch (_) { return deny('EXCEPTION_EXPIRY_INVALID'); }
  const nowMs = Date.parse(now);
  if (!Number.isFinite(expiry) || expiry <= nowMs || expiry > nowMs + 24 * 60 * 60 * 1000) {
    return deny('EXCEPTION_DURATION_OUT_OF_BOUNDS');
  }
  if (exception.scope.expires_at !== new Date(expiry).toISOString()) {
    return deny('EXCEPTION_SCOPE_EXPIRY_MISMATCH');
  }
  return {
    decision: 'EXCEPTIONAL_RELEASE_ELIGIBLE_NO_EXTERNAL_ACTION',
    release_class: 'EXCEPTIONAL',
    reason_code: 'BOUND_EXCEPTION_PREFLIGHT_PASSED',
    hold_id: record.hold_id,
    effect_digest: record.effect_digest,
    exception_id: exception.exception_id,
    authorized_by: exception.authorized_by,
    exception_expires_at: new Date(expiry).toISOString(),
    externalization_performed: false,
    evaluated_at: now
  };
}

function buildHoldLivenessMetrics(records, events, nowValue) {
  const now = Date.parse(nowValue || new Date().toISOString());
  if (!Number.isFinite(now)) throw new Error('HOLD_METRIC_TIME_INVALID');
  const queue = Array.isArray(records) ? records : [];
  const live = queue.filter(record => record && record.state === 'HOLD');
  const validCreated = live.map(record => Date.parse(record.created_at)).filter(Number.isFinite);
  const ages = validCreated.map(created => Math.max(0, Math.floor((now - created) / 1000)));
  const validExpiry = live.map(record => Date.parse(record.expires_at)).filter(Number.isFinite);
  const knownEvents = Array.isArray(events) ? events : null;
  const terminalEvents = knownEvents ? knownEvents.filter(event => event && event.type === 'HOLD_TERMINAL') : null;
  const falseHolds = terminalEvents ? terminalEvents.filter(event => event.outcome === 'FALSE_HOLD').length : null;
  const checkoutAttempts = knownEvents ? knownEvents.filter(event => event && event.type === 'CHECKOUT_ATTEMPT') : null;
  const abandonments = checkoutAttempts ? checkoutAttempts.filter(event => event.outcome === 'ABANDONED').length : null;
  const escalationDurations = knownEvents
    ? knownEvents.filter(event => event && event.type === 'HOLD_ESCALATION' && Number.isFinite(Date.parse(event.started_at)) && Number.isFinite(Date.parse(event.resolved_at)))
      .map(event => Math.max(0, Math.floor((Date.parse(event.resolved_at) - Date.parse(event.started_at)) / 1000)))
    : null;

  return {
    schema: 'DREAMLEDGER/HOLD-LIVENESS/v1',
    measured_at: new Date(now).toISOString(),
    source_state: knownEvents ? 'EVENTS_SUPPLIED' : 'EVENT_HISTORY_UNAVAILABLE',
    active_hold_count: live.length,
    expired_active_hold_count: validExpiry.filter(expiry => expiry <= now).length,
    oldest_active_hold_age_seconds: ages.length ? Math.max(...ages) : null,
    mean_active_hold_age_seconds: ages.length ? Math.round(ages.reduce((sum, age) => sum + age, 0) / ages.length) : null,
    false_hold_rate: terminalEvents && terminalEvents.length
      ? Number((falseHolds / terminalEvents.length).toFixed(4))
      : null,
    false_hold_observation_count: terminalEvents ? terminalEvents.length : null,
    checkout_abandonment_rate: checkoutAttempts && checkoutAttempts.length
      ? Number((abandonments / checkoutAttempts.length).toFixed(4))
      : null,
    checkout_attempt_observation_count: checkoutAttempts ? checkoutAttempts.length : null,
    mean_escalation_latency_seconds: escalationDurations && escalationDurations.length
      ? Math.round(escalationDurations.reduce((sum, seconds) => sum + seconds, 0) / escalationDurations.length)
      : null,
    resolver_failure_count: knownEvents
      ? knownEvents.filter(event => event && event.type === 'RESOLVER_FAILURE').length
      : null,
    effect_drift_rejection_count: knownEvents
      ? knownEvents.filter(event => event && event.type === 'HOLD_DECISION' && event.reason_code === 'EFFECT_MATERIAL_CHANGED_NEW_HOLD_AND_AUTHORITY_REQUIRED').length
      : null,
    unknowns_are_null_not_zero: true,
    external_actions_performed: false
  };
}

module.exports = { SCHEMA, REQUIRED_FIELDS, canonicalEffectPayload, digestEffect, createHoldRecord, evaluateHold, evaluateExceptionalRelease, buildHoldLivenessMetrics };
