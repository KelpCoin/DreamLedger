'use strict';

const AUTHORIZATION_STATES = new Set(['NONE','AUTHORITY_REQUIRED','AUTHORIZED','REJECTED','EXPIRED']);
const EXECUTION_STATES = new Set(['PREPARED','AUTHORITY_REQUIRED','AUTHORIZED','ACTUATOR_UNAVAILABLE','EXECUTING','SUCCEEDED','FAILED','EXPIRED','REJECTED']);

function makeAction(input) {
  if (!input || typeof input !== 'object') throw new TypeError('action must be an object');
  const authorizationState = String(input.authorization_state || (input.approval_required === false ? 'AUTHORIZED' : 'AUTHORITY_REQUIRED')).toUpperCase();
  const executionState = String(input.execution_state || 'PREPARED').toUpperCase();
  if (!AUTHORIZATION_STATES.has(authorizationState)) throw new Error('invalid authorization state: ' + authorizationState);
  if (!EXECUTION_STATES.has(executionState)) throw new Error('invalid execution state: ' + executionState);
  if (!input.idempotency_key) throw new Error('idempotency_key required');
  return {
    action_id: input.action_id || null,
    cell_id: input.cell_id || null,
    actor: input.actor || 'CUBE',
    target: input.target || null,
    action_type: input.action_type || null,
    payload: input.payload || {},
    authorization_state: authorizationState,
    credential_requirement: input.credential_requirement || null,
    idempotency_key: String(input.idempotency_key),
    created_at: input.created_at || new Date().toISOString(),
    expires_at: input.expires_at || null,
    execution_state: executionState,
    external_reference: input.external_reference || null,
    result: input.result || null,
    evidence_reference: input.evidence_reference || null,
    authorization_request: input.authorization_request || null,
    actuator_id: input.actuator_id || null
  };
}

function approve(action, approver) {
  if (!approver) throw new Error('approver required');
  if (action.authorization_state !== 'AUTHORITY_REQUIRED') throw new Error('action is not awaiting authority');
  return { ...action, authorization_state:'AUTHORIZED', execution_state:'AUTHORIZED', approved_by:String(approver), approved_at:new Date().toISOString() };
}

function reject(action, reason) {
  return { ...action, authorization_state:'REJECTED', execution_state:'REJECTED', rejection_reason:String(reason || 'rejected') };
}

function expire(action, now = Date.now()) {
  if (!action.expires_at || Date.parse(action.expires_at) > now) return action;
  return { ...action, authorization_state:'EXPIRED', execution_state:'EXPIRED' };
}

module.exports = { AUTHORIZATION_STATES:[...AUTHORIZATION_STATES], EXECUTION_STATES:[...EXECUTION_STATES], makeAction, approve, reject, expire };
