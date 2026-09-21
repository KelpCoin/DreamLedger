'use strict';

const crypto = require('crypto');

const STATES = Object.freeze([
  'DRAFT',
  'READY',
  'ACTIVE',
  'ACTION_PREPARED',
  'AUTHORITY_REQUIRED',
  'AUTHORIZED',
  'EXECUTING',
  'EXTERNAL_EFFECT',
  'TRANSACTION_SETTLED',
  'FULFILLED',
  'EVIDENCE',
  'VERIFIED',
  'REPLICABLE',
  'FAILED',
  'QUARANTINED',
  'EXPIRED',
  'EXTERNAL_ACTUATOR_UNAVAILABLE'
]);

const TRANSITIONS = Object.freeze({
  DRAFT: ['READY', 'QUARANTINED'],
  READY: ['ACTIVE', 'ACTION_PREPARED', 'QUARANTINED'],
  ACTIVE: ['ACTION_PREPARED', 'QUARANTINED'],
  ACTION_PREPARED: ['AUTHORITY_REQUIRED', 'QUARANTINED'],
  AUTHORITY_REQUIRED: ['AUTHORIZED', 'EXPIRED', 'QUARANTINED'],
  AUTHORIZED: ['EXECUTING', 'EXPIRED', 'QUARANTINED'],
  EXECUTING: ['EXTERNAL_EFFECT', 'FAILED', 'EXTERNAL_ACTUATOR_UNAVAILABLE'],
  EXTERNAL_EFFECT: ['TRANSACTION_SETTLED', 'FAILED', 'QUARANTINED'],
  TRANSACTION_SETTLED: ['FULFILLED', 'FAILED', 'QUARANTINED'],
  FULFILLED: ['EVIDENCE', 'FAILED', 'QUARANTINED'],
  EVIDENCE: ['VERIFIED', 'FAILED', 'QUARANTINED'],
  VERIFIED: ['REPLICABLE', 'QUARANTINED'],
  REPLICABLE: [],
  FAILED: ['QUARANTINED', 'ACTION_PREPARED'],
  EXPIRED: ['ACTION_PREPARED', 'QUARANTINED'],
  EXTERNAL_ACTUATOR_UNAVAILABLE: ['AUTHORITY_REQUIRED', 'ACTION_PREPARED', 'QUARANTINED'],
  QUARANTINED: []
});

const REQUIRED_CELL_FIELDS = Object.freeze([
  'cell_id', 'object', 'buyer', 'demand', 'offer', 'channel',
  'fulfillment', 'attribution', 'evidence', 'verification_rules',
  'authority_requirements', 'lifecycle_state'
]);

function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
}

function hash(value) {
  return crypto.createHash('sha256').update(canonical(value), 'utf8').digest('hex');
}

function validateCell(cell) {
  const value = cell && typeof cell === 'object' ? cell : {};
  const missing = REQUIRED_CELL_FIELDS.filter(field => value[field] === undefined || value[field] === null);
  if (missing.length) return { ok: false, status: 'INVALID', missing };
  if (!STATES.includes(value.lifecycle_state)) return { ok: false, status: 'INVALID', missing: [], reason: 'INVALID_LIFECYCLE_STATE' };
  if (!value.offer.sku || !Number.isFinite(Number(value.offer.price_nzd)) || Number(value.offer.price_nzd) <= 0) {
    return { ok: false, status: 'INVALID', missing: [], reason: 'INVALID_OFFER' };
  }
  return { ok: true, status: 'VALID', lifecycle_state: value.lifecycle_state, cell_id: String(value.cell_id) };
}

function assertTransition(from, to) {
  if (!STATES.includes(from) || !STATES.includes(to) || !(TRANSITIONS[from] || []).includes(to)) {
    throw new Error('INVALID_TRANSITION:' + from + '->' + to);
  }
  return true;
}

function idempotencyKey(actionRequest) {
  return 'act_' + hash(actionRequest).slice(0, 48);
}

function prepareAuthority(actionRequest) {
  if (!actionRequest || typeof actionRequest !== 'object') throw new TypeError('action_request_required');
  const key = idempotencyKey(actionRequest);
  return {
    schema: 'dreamledger.authority-request.v1',
    action_id: actionRequest.action_id || key,
    idempotency_key: key,
    state: 'PENDING_AUTHORITY',
    authorization_state: 'PENDING_AUTHORITY',
    execution_allowed: false,
    payload: actionRequest.payload || {},
    expected_consequence: actionRequest.expected_consequence || null,
    reversible: actionRequest.reversible === true,
    credentials_required: Array.isArray(actionRequest.credentials_required) ? [...actionRequest.credentials_required] : [],
    expires_at: actionRequest.expires_at || null
  };
}

function evaluateBusinessTruth(input) {
  const value = input && typeof input === 'object' ? input : {};
  const missing = [];
  if (value.classification !== 'OBSERVED') missing.push('live_external_event');
  if (value.external_buyer !== true) missing.push('external_buyer');
  if (value.settled_transaction !== true) missing.push('settlement');
  if (value.attributed !== true) missing.push('attribution');
  if (value.fulfilled !== true) missing.push('fulfillment');
  if (!Array.isArray(value.evidence) || value.evidence.length < 1) missing.push('evidence');
  if (!value.external_reference) missing.push('external_reference');
  return {
    status: missing.length ? (value.classification === 'TEST' ? 'TEST' : 'UNVERIFIED') : 'VERIFIED',
    verified: missing.length === 0,
    missing
  };
}

function executeWithActuator({ action_request, actuator }) {
  if (!actuator || actuator.status !== 'AVAILABLE') {
    return {
      state: 'EXTERNAL_ACTUATOR_UNAVAILABLE',
      execution_state: 'BLOCKED',
      external_effect: null,
      external_reference: null,
      idempotency_key: action_request && action_request.idempotency_key || null
    };
  }
  return {
    state: 'EXECUTING',
    execution_state: 'EXECUTING',
    actuator_id: actuator.actuator_id || null,
    external_effect: null,
    external_reference: null,
    idempotency_key: action_request && action_request.idempotency_key || idempotencyKey(action_request)
  };
}

function replicationStatus(outcomes) {
  const verified = Array.isArray(outcomes) ? outcomes.filter(x => x && x.status === 'VERIFIED') : [];
  const buyers = new Set(verified.map(x => x.buyer_key).filter(Boolean));
  return verified.length >= 2 && buyers.size >= 2
    ? { state: 'REPLICABLE', verified_transactions: verified.length, independent_buyers: buyers.size }
    : { state: 'VERIFIED_NOT_REPLICABLE', verified_transactions: verified.length, independent_buyers: buyers.size };
}

function quarantine(reason, context = {}) {
  return {
    state: 'QUARANTINED',
    reason: String(reason || 'UNSPECIFIED'),
    context,
    preserved: true,
    quarantined_at: new Date().toISOString()
  };
}

function buildReadinessReport(input = {}) {
  return {
    schema: 'dreamledger.economic-readiness.v1',
    verified_revenue_nzd: Number(input.verified_revenue_nzd || 0),
    verified_external_payments: Number(input.verified_external_payments || 0),
    active_cells: Array.isArray(input.active_cells) ? input.active_cells : [],
    next_external_transition: input.next_external_transition || 'NONE',
    blockers: Array.isArray(input.blockers) ? input.blockers : [],
    actuator_status: input.actuator_status || 'ACTUATOR_UNAVAILABLE',
    human_authority_requirements: Array.isArray(input.human_authority_requirements) ? input.human_authority_requirements : [],
    generated_at: new Date().toISOString()
  };
}

function attentionEvent(input = {}) {
  return {
    schema: 'dreamledger.human-attention.v1',
    event_id: input.event_id || idempotencyKey(input),
    action_id: input.action_id || null,
    minutes: Number.isFinite(Number(input.minutes)) ? Number(input.minutes) : 0,
    intervention_type: input.intervention_type || 'AUTHORITY',
    recorded: true
  };
}

module.exports = {
  STATES,
  TRANSITIONS,
  canonical,
  hash,
  validateCell,
  assertTransition,
  idempotencyKey,
  prepareAuthority,
  evaluateBusinessTruth,
  executeWithActuator,
  replicationStatus,
  quarantine,
  buildReadinessReport,
  attentionEvent
};
