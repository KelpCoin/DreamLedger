'use strict';

const crypto = require('crypto');

const STATUS = Object.freeze([
  'ADAPTER_READY',
  'SIMULATED',
  'BLOCKED_LIVE',
  'NOT_VERIFIED',
  'NOT_IMPLEMENTED',
  'UNSUPPORTED'
]);

const ACCESS_TIERS = Object.freeze([
  'PUBLIC',
  'FREE',
  'AUTHENTICATED',
  'PAID',
  'HIGH_VALUE',
  'RESTRICTED'
]);

const ECONOMIC_STATUSES = Object.freeze([
  'VERIFIED',
  'UNVERIFIED',
  'CONTRADICTED',
  'STALE',
  'TEST',
  'SIMULATED',
  'INTERNAL',
  'UNMATCHED'
]);

const RAILS = Object.freeze(['ACP', 'AP2', 'UCP', 'MCP', 'MANUAL', 'OTHER']);

function assertEnum(value, allowed, field) {
  if (!allowed.includes(value)) throw new Error(field + ' must be one of: ' + allowed.join(', '));
}

function makeEconomicEvent(input) {
  if (!input || typeof input !== 'object') throw new Error('event input required');
  if (!input.event_id || !input.event_type) throw new Error('event_id and event_type required');
  assertEnum(input.rail || 'OTHER', RAILS, 'rail');
  assertEnum(input.economic_status || 'UNVERIFIED', ECONOMIC_STATUSES, 'economic_status');
  return Object.freeze({
    schema_version: 'DL-EVENT-1.0',
    event_id: String(input.event_id),
    event_type: String(input.event_type),
    rail: input.rail || 'OTHER',
    economic_status: input.economic_status || 'UNVERIFIED',
    occurred_at: input.occurred_at || new Date().toISOString(),
    buyer_ref: input.buyer_ref || null,
    offer_ref: input.offer_ref || null,
    amount: input.amount ?? null,
    currency: input.currency || null,
    attribution_ref: input.attribution_ref || null,
    fulfillment_ref: input.fulfillment_ref || null,
    evidence_refs: Array.isArray(input.evidence_refs) ? input.evidence_refs.slice() : [],
    metadata: input.metadata && typeof input.metadata === 'object' ? {...input.metadata} : {}
  });
}

function makeTopologyNode(input) {
  if (!input?.node_id || !input?.capability) throw new Error('node_id and capability required');
  return Object.freeze({
    node_id: String(input.node_id),
    capability: String(input.capability),
    model_ref: input.model_ref || null,
    proficiency: normalizeProficiency(input.proficiency),
    accepts: Array.isArray(input.accepts) ? input.accepts.slice() : [],
    produces: Array.isArray(input.produces) ? input.produces.slice() : []
  });
}

function normalizeProficiency(value) {
  const v = value && typeof value === 'object' ? value : {};
  const clamp = x => Math.max(0, Math.min(1, Number.isFinite(Number(x)) ? Number(x) : 0));
  return Object.freeze({
    reliability: clamp(v.reliability),
    latency: clamp(v.latency),
    evidence_quality: clamp(v.evidence_quality),
    task_fit: clamp(v.task_fit),
    sample_count: Math.max(0, Number(v.sample_count || 0))
  });
}

function makeTopologyEdge(input) {
  if (!input?.from || !input?.to) throw new Error('from and to required');
  return Object.freeze({
    from: String(input.from),
    to: String(input.to),
    topic: String(input.topic || 'default'),
    weight: Number.isFinite(Number(input.weight)) ? Number(input.weight) : 1,
    enabled: input.enabled !== false
  });
}

function makeTaskEnvelope(input) {
  if (!input?.task_id || !input?.objective) throw new Error('task_id and objective required');
  return Object.freeze({
    schema_version: 'DL-TASK-1.0',
    task_id: String(input.task_id),
    objective: String(input.objective),
    constraints: input.constraints && typeof input.constraints === 'object' ? {...input.constraints} : {},
    evidence: Array.isArray(input.evidence) ? input.evidence.slice() : [],
    authorization: input.authorization || 'LOCAL_ONLY',
    requested_capability: input.requested_capability || null,
    external_effect: input.external_effect === true,
    approval_required: input.approval_required !== false
  });
}

function makePublicSurfaceRecord(input) {
  if (!input?.subject_id || !input?.status) throw new Error('subject_id and status required');
  assertEnum(input.access_tier || 'PUBLIC', ACCESS_TIERS, 'access_tier');
  return Object.freeze({
    schema_version: 'DL-PUBLIC-SURFACE-1.0',
    subject_id: String(input.subject_id),
    status: String(input.status),
    access_tier: input.access_tier || 'PUBLIC',
    claim: input.claim || null,
    evidence_refs: Array.isArray(input.evidence_refs) ? input.evidence_refs.slice() : [],
    sanitized: true,
    contains_secrets: false,
    contains_pii: false,
    live_deployment_verified: input.live_deployment_verified === true,
    live_traffic_verified: input.live_traffic_verified === true
  });
}

function signObservation(payload, privateKey) {
  if (!privateKey) throw new Error('private key required');
  const bytes = Buffer.from(JSON.stringify(payload), 'utf8');
  const signature = crypto.sign(null, bytes, privateKey);
  return {
    algorithm: 'Ed25519',
    payload,
    payload_sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    signature_base64: signature.toString('base64')
  };
}

function verifyObservation(attestation, publicKey) {
  if (!attestation?.payload || !attestation?.signature_base64 || !publicKey) return false;
  const bytes = Buffer.from(JSON.stringify(attestation.payload), 'utf8');
  return crypto.verify(null, bytes, publicKey, Buffer.from(attestation.signature_base64, 'base64'));
}

function makeHealthContract(input) {
  if (!input?.adapter_id) throw new Error('adapter_id required');
  assertEnum(input.status || 'NOT_VERIFIED', STATUS, 'status');
  return Object.freeze({
    schema_version: 'DL-ADAPTER-1.0',
    adapter_id: String(input.adapter_id),
    status: input.status || 'NOT_VERIFIED',
    live_verification: input.live_verification === true,
    credentials_required: input.credentials_required === true,
    healthcheck: input.healthcheck || null,
    fixture: input.fixture || null,
    last_checked_at: input.last_checked_at || null
  });
}

function economicAlignment(scores) {
  const keys = ['stability', 'integrity', 'welfare', 'profitability', 'reusability'];
  const values = keys.map(k => Math.max(0, Math.min(1, Number(scores?.[k] ?? 0))));
  const total = values.reduce((a,b) => a+b, 0) / keys.length;
  return {score: total, dimensions: Object.fromEntries(keys.map((k,i) => [k, values[i]])), advisory_only: true};
}

module.exports = {
  STATUS, ACCESS_TIERS, ECONOMIC_STATUSES, RAILS,
  makeEconomicEvent, makeTopologyNode, makeTopologyEdge, makeTaskEnvelope,
  makePublicSurfaceRecord, signObservation, verifyObservation, makeHealthContract,
  economicAlignment, normalizeProficiency
};
