'use strict';

/**
 * BEC Defensive Control Plane
 * Deterministic guardrail layer for agent-to-system mutations.
 *
 * Design target: reduce excessive agency, tool misuse, identity spoofing,
 * replay, and accidental high-impact execution without changing the
 * economic truth model.
 */

const crypto = require('crypto');

const MAX_BODY_BYTES = 200000;
const RATE_WINDOW_MS = 60000;
const RATE_LIMIT = 120;
const buckets = new Map();

const HIGH_IMPACT_EVENTS = new Set([
  'ACTION_EXECUTED',
  'PAYMENT_DETECTED',
  'FULFILLMENT_COMPLETED',
  'RECONCILIATION_COMPLETED'
]);

const MUTATING_NOTE_TYPES = new Set([
  'STRUCTURED_EVENT',
  'DECISION',
  'WARNING',
  'FINDING'
]);

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function requestFingerprint({ agent, path, correlationId, body }) {
  return sha256(JSON.stringify({
    agent: String(agent || '').toLowerCase(),
    path: String(path || ''),
    correlation_id: String(correlationId || ''),
    body: body || {}
  }));
}

function allowRate(key, now = Date.now()) {
  const k = String(key || 'unknown');
  const current = buckets.get(k);
  if (!current || now - current.started_at >= RATE_WINDOW_MS) {
    buckets.set(k, { started_at: now, count: 1 });
    if (buckets.size > 2048) {
      for (const [id, bucket] of buckets) {
        if (now - bucket.started_at >= RATE_WINDOW_MS) buckets.delete(id);
      }
    }
    return { allowed: true, remaining: RATE_LIMIT - 1 };
  }
  current.count += 1;
  return {
    allowed: current.count <= RATE_LIMIT,
    remaining: Math.max(0, RATE_LIMIT - current.count)
  };
}

function validateActionBoundary(event, context = {}) {
  const type = String(event?.event_type || '').trim().toUpperCase();
  const lane = String(event?.lane || '').trim().toLowerCase();
  const agent = String(event?.agent || '').trim().toLowerCase();
  const evidence = Array.isArray(event?.evidence) ? event.evidence : [];
  const errors = [];

  if (HIGH_IMPACT_EVENTS.has(type) && !event?.correlation_id) {
    errors.push('high-impact events require correlation_id');
  }

  if (type === 'ACTION_APPROVED' && !['human', 'system'].includes(agent)) {
    errors.push('ACTION_APPROVED requires human/system authority');
  }

  if (type === 'ACTION_EXECUTED') {
    if (lane !== 'execution') errors.push('ACTION_EXECUTED requires execution lane');
    if (!event?.subject_id) errors.push('ACTION_EXECUTED requires subject_id');
    if (evidence.length === 0 && context.requireExecutionEvidence !== false) {
      errors.push('ACTION_EXECUTED requires evidence references');
    }
  }

  if (type === 'PAYMENT_DETECTED' && lane !== 'payment') {
    errors.push('PAYMENT_DETECTED requires payment lane');
  }

  if (type === 'FULFILLMENT_COMPLETED' && lane !== 'fulfillment') {
    errors.push('FULFILLMENT_COMPLETED requires fulfillment lane');
  }

  if (type === 'RECONCILIATION_COMPLETED' && lane !== 'reconciliation') {
    errors.push('RECONCILIATION_COMPLETED requires reconciliation lane');
  }

  if (event?.requested_action && /(^|\b)(delete|drop|truncate|transfer|pay|charge|refund|publish|send|deploy|rotate|revoke)(\b|$)/i.test(String(event.requested_action))) {
    if (!['human', 'system'].includes(agent) && type !== 'ACTION_PROPOSED') {
      errors.push('privileged requested_action requires human/system authority or proposal-only state');
    }
  }

  return {
    allowed: errors.length === 0,
    errors,
    high_impact: HIGH_IMPACT_EVENTS.has(type)
  };
}

function validateNoteBoundary(note) {
  const type = String(note?.note_type || 'HANDOFF').trim().toUpperCase();
  const body = String(note?.body || '');
  const errors = [];
  if (MUTATING_NOTE_TYPES.has(type) && body.length > 50000) {
    errors.push('mutation-capable note body exceeds 50000 bytes');
  }
  if (type === 'STRUCTURED_EVENT' && !note?.event_id) {
    errors.push('STRUCTURED_EVENT requires event_id');
  }
  return { allowed: errors.length === 0, errors };
}

function securityManifest() {
  return {
    schema_version: 'BEC-DEFENSIVE-CONTROL-PLANE-1.0',
    controls: [
      'least-agency',
      'human-approval-for-high-impact-actions',
      'deterministic-event-boundaries',
      'correlation-required-for-high-impact-events',
      'request-fingerprinting',
      'bounded-body-size',
      'bounded-rate-limit',
      'idempotent-event-replay'
    ],
    irreversible_default: false,
    economic_truth_unchanged: true
  };
}

module.exports = {
  MAX_BODY_BYTES,
  HIGH_IMPACT_EVENTS,
  allowRate,
  requestFingerprint,
  validateActionBoundary,
  validateNoteBoundary,
  securityManifest
};
