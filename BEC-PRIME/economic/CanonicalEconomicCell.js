'use strict';

const STATES = new Set(['WATCH','READY','ACTIVE','BLOCKED','QUARANTINED','VERIFIED','REPLICABLE']);

function normalizeCell(input) {
  if (!input || typeof input !== 'object') throw new TypeError('economic cell must be an object');
  const state = String(input.canonical_state || input.state || 'WATCH').toUpperCase();
  if (!STATES.has(state)) throw new Error('invalid economic cell state: ' + state);
  return {
    cell_id: input.cell_id || null,
    economic_object: input.economic_object || {},
    buyer: input.buyer || {},
    demand_signal: input.demand_signal || {},
    offer: input.offer || {
      offer_id: input.offer_id || null,
      sku: input.sku || null,
      price_cents: input.price_cents ?? null,
      currency: input.currency || 'NZD'
    },
    transaction_channel: input.transaction_channel || input.checkout_url || null,
    fulfillment: input.fulfillment || {
      type: input.fulfillment_type || null,
      contract: input.fulfillment_contract || {}
    },
    attribution: input.attribution || {},
    evidence_requirements: input.evidence_requirements || {},
    verification_rules: input.verification_rules || {},
    human_authority_requirements: input.human_authority_requirements || { required: Boolean(input.approval_required) },
    external_actuator_requirements: input.external_actuator_requirements || {},
    success_condition: input.success_condition || {},
    failure_condition: input.failure_condition || {},
    replication_evidence: input.replication_evidence || {},
    human_attention: input.human_attention || {},
    state
  };
}

function assertVerifiableCell(cell) {
  const c = normalizeCell(cell);
  const missing = [];
  if (!c.cell_id) missing.push('cell_id');
  if (!c.offer.offer_id && !c.offer.sku) missing.push('offer');
  if (!c.evidence_requirements || typeof c.evidence_requirements !== 'object') missing.push('evidence_requirements');
  if (!c.verification_rules || typeof c.verification_rules !== 'object') missing.push('verification_rules');
  if (!c.success_condition || typeof c.success_condition !== 'object') missing.push('success_condition');
  return { ok: missing.length === 0, missing, cell: c };
}

module.exports = { STATES: [...STATES], normalizeCell, assertVerifiableCell };
