'use strict';

/*
 * DreamLedger Browser Actuator Contract
 *
 * This module is deliberately vendor-neutral. It does not declare an external
 * action successful. The actuator may only return ATTEMPTED/FAILED; the
 * independent verifier is responsible for EXTERNAL_EFFECT_VERIFIED.
 */

const crypto = require('crypto');

const STATUS = Object.freeze({
  PREPARED: 'PREPARED',
  AWAITING_APPROVAL: 'AWAITING_APPROVAL',
  AUTHORIZED: 'AUTHORIZED',
  ACTUATING: 'ACTUATING',
  ATTEMPTED: 'ATTEMPTED',
  VERIFYING: 'VERIFYING',
  EXTERNAL_EFFECT_VERIFIED: 'EXTERNAL_EFFECT_VERIFIED',
  FAILED: 'FAILED',
  BLOCKED: 'BLOCKED'
});

const ACTIONS = Object.freeze([
  'TRADEME_CREATE_LISTING',
  'TRADEME_EDIT_LISTING',
  'TRADEME_WITHDRAW_LISTING',
  'TRADEME_RELIST'
]);

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function normalizeAction(packet) {
  if (!packet || typeof packet !== 'object') throw new Error('action packet required');
  const actionId = String(packet.action_id || '').trim();
  const actionType = String(packet.action_type || '').trim();
  const approvalId = String(packet.approval_id || '').trim();
  const idempotencyKey = String(packet.idempotency_key || '').trim();
  if (!actionId || !actionType || !approvalId || !idempotencyKey) {
    throw new Error('action_id, action_type, approval_id and idempotency_key are required');
  }
  if (!ACTIONS.includes(actionType)) throw new Error('unsupported browser action');
  if (packet.financial_impact && Number(packet.financial_impact.amount || 0) > 0) {
    throw new Error('browser actuator cannot authorize spending');
  }
  return {
    action_id: actionId,
    action_type: actionType,
    approval_id: approvalId,
    idempotency_key: idempotencyKey,
    target_platform: String(packet.target_platform || 'trademe'),
    target_account: String(packet.target_account || ''),
    exact_payload: packet.exact_payload || {},
    expected_external_effect: String(packet.expected_external_effect || ''),
    expected_evidence: packet.expected_evidence || [],
    verification_method: String(packet.verification_method || 'independent_external_read'),
    risk_class: String(packet.risk_class || 'EXTERNAL_PUBLISH'),
    reversible: packet.reversible !== false
  };
}

function createAttemptReceipt(packet, adapterResult) {
  const p = normalizeAction(packet);
  return {
    status: STATUS.ATTEMPTED,
    action_id: p.action_id,
    action_type: p.action_type,
    approval_id: p.approval_id,
    idempotency_key: p.idempotency_key,
    target_platform: p.target_platform,
    target_account: p.target_account || null,
    actuator: String(adapterResult && adapterResult.actuator || 'browser-adapter'),
    external_ref: adapterResult && adapterResult.external_ref || null,
    external_url: adapterResult && adapterResult.external_url || null,
    attempted_at: new Date().toISOString(),
    request_hash: sha256(JSON.stringify(p.exact_payload)),
    adapter_receipt_hash: sha256(JSON.stringify(adapterResult || {})),
    verifier_required: true
  };
}

module.exports = { STATUS, ACTIONS, normalizeAction, createAttemptReceipt, sha256 };
