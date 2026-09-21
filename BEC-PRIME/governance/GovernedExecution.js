'use strict';

const crypto = require('crypto');

const TERMINAL_KILL_STATES = new Set(['TRIPPED', 'FROZEN']);
const EXTERNAL_ACTIONS = new Set(['publish', 'send', 'purchase', 'refund', 'delete', 'credential_access']);

function now() { return new Date().toISOString(); }
function id(prefix) { return prefix + '_' + crypto.randomBytes(10).toString('hex'); }
function hash(value) { return crypto.createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex'); }

function normalizeTransition(input) {
  if (!input || typeof input !== 'object') throw new Error('transition must be an object');
  for (const field of ['transition_id', 'transition_name', 'entity_id', 'idempotency_key', 'schema_version']) {
    if (!input[field]) throw new Error('missing ' + field);
  }
  return {
    transition_id: String(input.transition_id),
    transition_name: String(input.transition_name),
    entity_id: String(input.entity_id),
    idempotency_key: String(input.idempotency_key),
    schema_version: String(input.schema_version),
    requested_by: String(input.requested_by || 'unknown'),
    requested_at: input.requested_at || now(),
    from_state: input.from_state || null,
    to_state: input.to_state || null,
    evidence: input.evidence && typeof input.evidence === 'object' ? input.evidence : {},
    requested_action: input.requested_action || null,
    blast_radius: input.blast_radius && typeof input.blast_radius === 'object' ? input.blast_radius : {}
  };
}

function evaluateTransition(policy, input, runtime = {}) {
  const t = normalizeTransition(input);
  const checks = [];
  const pass = (id, message) => checks.push({ id, status: 'PASS', message });
  const fail = (id, message) => checks.push({ id, status: 'FAIL', message });

  if (runtime.kill_state && TERMINAL_KILL_STATES.has(runtime.kill_state)) fail('kill_switch', 'Execution is frozen by independent kill state');
  else pass('kill_switch', 'Execution authority is not frozen');

  if (policy.default !== 'DENY') fail('default_deny', 'Governance policy must be default-deny');
  else pass('default_deny', 'Governance policy is default-deny');

  if (policy.authorization.require_transition_id && !t.transition_id) fail('transition_id', 'Transition ID required');
  else pass('transition_id', 'Transition ID present');

  if (policy.authorization.require_policy_version && !policy.policy_version) fail('policy_version', 'Policy version required');
  else pass('policy_version', 'Policy version present');

  const action = String(t.requested_action || '').toLowerCase();
  if (action && EXTERNAL_ACTIONS.has(action)) {
    if (!t.evidence.authorization_record) fail('authorization_record', 'External action requires an explicit authorization record');
    else pass('authorization_record', 'Authorization record present');

    if (!t.evidence.checkpoint_id) fail('checkpoint_id', 'External action requires a checkpoint');
    else pass('checkpoint_id', 'Checkpoint present');

    const spend = Number(t.blast_radius.max_spend_nzd ?? 0);
    const recipients = Number(t.blast_radius.max_recipients ?? 0);
    const actions = Number(t.blast_radius.max_external_actions ?? 0);
    if (spend > Number(policy.blast_radius.max_spend_nzd)) fail('blast_radius.spend', 'Requested spend exceeds policy');
    else pass('blast_radius.spend', 'Spend is within policy');
    if (recipients > Number(policy.blast_radius.max_recipients)) fail('blast_radius.recipients', 'Recipient count exceeds policy');
    else pass('blast_radius.recipients', 'Recipient count is within policy');
    if (actions > Number(policy.blast_radius.max_external_actions)) fail('blast_radius.actions', 'External action count exceeds policy');
    else pass('blast_radius.actions', 'External action count is within policy');

    if (policy.garage.required_for_external_side_effects) {
      if (runtime.garage_status !== 'READY_FOR_PROMOTION') fail('garage', 'External action must remain in the 24-hour garage until promotion');
      else pass('garage', 'Garage hold satisfied');
    }
  }

  return {
    decision: checks.every(x => x.status === 'PASS') ? 'ADMIT' : 'REJECT',
    transition: t,
    checks,
    policy_version: policy.policy_version,
    evaluated_at: now()
  };
}

function stageInGarage(policy, transition, stagedAt = now()) {
  const t = normalizeTransition(transition);
  const at = Date.parse(stagedAt);
  if (!Number.isFinite(at)) throw new Error('invalid staged_at');
  return {
    garage_id: id('garage'),
    transition_id: t.transition_id,
    status: 'STAGED',
    staged_at: new Date(at).toISOString(),
    eligible_at: new Date(at + Number(policy.garage.minimum_hold_hours) * 3600000).toISOString(),
    external_credentials_available: false,
    artifact_hash: hash(t),
    created_at: now()
  };
}

function evaluateGaragePromotion(policy, garage, at = Date.now()) {
  if (!garage || garage.status !== 'STAGED') return { eligible: false, reason: 'garage_not_staged' };
  const eligibleAt = Date.parse(garage.eligible_at);
  if (!Number.isFinite(eligibleAt)) return { eligible: false, reason: 'invalid_eligible_at' };
  if (Number(at) < eligibleAt) return { eligible: false, reason: 'hold_period_not_elapsed' };
  if (garage.external_credentials_available !== false) return { eligible: false, reason: 'garage_has_external_credentials' };
  return { eligible: true, reason: 'hold_period_elapsed' };
}

function canaryDecision(policy, sample) {
  const abnormal = Number(sample?.abnormal_events || 0);
  const contradictions = Number(sample?.verification_contradictions || 0);
  const unexpected = Number(sample?.unexpected_external_effects || 0);
  const trip = abnormal > 0 || contradictions > 0 || unexpected > 0;
  return {
    decision: trip && policy.canary.auto_rollback_on_trip ? 'ROLLBACK' : 'CONTINUE',
    trip,
    treatment_percent: Number(policy.canary.treatment_percent),
    control_percent: Number(policy.canary.control_percent),
    reasons: [
      ...(abnormal > 0 ? ['abnormal_events'] : []),
      ...(contradictions > 0 ? ['verification_contradictions'] : []),
      ...(unexpected > 0 ? ['unexpected_external_effects'] : [])
    ]
  };
}

function killSwitch(current, reason, actor = 'automatic-circuit-breaker') {
  if (TERMINAL_KILL_STATES.has(current?.state)) return current;
  return {
    state: 'TRIPPED',
    reason: String(reason || 'unspecified'),
    actor: String(actor),
    tripped_at: now(),
    revocation_id: id('revoke')
  };
}

function authorizeAction(policy, input, context = {}) {
  const action = String(input?.action || '').toLowerCase();
  const token = {
    authorization_id: id('auth'),
    action,
    transition_id: input?.transition_id || null,
    policy_version: policy.policy_version,
    issued_at: now(),
    expires_at: input?.expires_at || null,
    capability: input?.capability || null,
    scope: input?.scope || {},
    blast_radius: input?.blast_radius || {}
  };
  const failures = [];
  if (policy.authorization.default !== 'DENY') failures.push('authorization_policy_not_default_deny');
  if (!EXTERNAL_ACTIONS.has(action)) failures.push('unknown_external_action');
  if (policy.authorization.require_transition_id && !token.transition_id) failures.push('missing_transition_id');
  if (policy.authorization.require_expiry && !token.expires_at) failures.push('missing_expiry');
  if (policy.authorization.require_explicit_capability && !token.capability) failures.push('missing_capability');
  if (context.kill_state && TERMINAL_KILL_STATES.has(context.kill_state)) failures.push('kill_switch_tripped');
  return { decision: failures.length ? 'DENY' : 'ALLOW', token, failures };
}

function createEvent(type, payload) {
  return {
    event_id: id('evt'),
    event_type: type,
    schema_version: 'DL-GOV-EVENT-1.0',
    idempotency_key: payload?.idempotency_key || id('idem'),
    created_at: now(),
    payload: payload || {}
  };
}

function provenanceFact(input) {
  return {
    fact_id: id('fact'),
    entity: String(input.entity),
    relation: String(input.relation),
    value: input.value,
    source: String(input.source),
    observed_at: input.observed_at || now(),
    confidence: input.confidence ?? null,
    scope: input.scope || null,
    evidence_status: input.evidence_status || 'UNVERIFIED',
    evidence_hash: hash(input)
  };
}

function circuitBreaker(policy, metrics) {
  const reasons = [];
  if (Number(metrics?.policy_violations || 0) > 0) reasons.push('policy_violation');
  if (Number(metrics?.authorization_anomalies || 0) > 0) reasons.push('authorization_anomaly');
  if (Number(metrics?.unexpected_external_effects || 0) > 0) reasons.push('unexpected_external_effect');
  if (Number(metrics?.verification_contradictions || 0) > 0) reasons.push('verification_contradiction');
  if (Number(metrics?.external_actions || 0) > Number(policy.blast_radius.max_external_actions)) reasons.push('blast_radius_exceeded');
  return reasons.length ? { trip: true, reasons } : { trip: false, reasons: [] };
}

module.exports = {
  normalizeTransition,
  evaluateTransition,
  stageInGarage,
  evaluateGaragePromotion,
  canaryDecision,
  killSwitch,
  authorizeAction,
  createEvent,
  provenanceFact,
  circuitBreaker,
  hash
};
