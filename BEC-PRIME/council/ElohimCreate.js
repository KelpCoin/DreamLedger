'use strict';

const crypto = require('crypto');

const DEFAULT_PRICE_NZD = 49;

function stableId(capability, signal) {
  const seed = JSON.stringify({
    capability_id: capability.id,
    signal_id: signal?.signal_id || null,
    demand: signal?.demand || signal?.problem || null
  });
  return `ELOHIM-CANDIDATE-${crypto.createHash('sha256').update(seed).digest('hex').slice(0, 16).toUpperCase()}`;
}

function priceProposal(capability) {
  if (Array.isArray(capability.tiers) && capability.tiers.length) {
    return capability.tiers.map(t => Number(t.price)).filter(Number.isFinite);
  }
  if (Number.isFinite(Number(capability.price))) return [Number(capability.price)];
  return [DEFAULT_PRICE_NZD];
}

function createCandidate(capability, signal = null) {
  if (!capability?.id || !capability?.name) {
    throw new TypeError('ElohimCreate requires capability.id and capability.name.');
  }

  const prices = priceProposal(capability);
  const demand = signal?.demand || signal?.problem || capability.summary || 'Customer problem to be validated externally.';

  return {
    id: stableId(capability, signal),
    schema_version: 'BEC-ELOHIM-CREATED-CANDIDATE-1.0',
    status: 'ELOHIM_CREATED_CANDIDATE',
    silo: capability.silo || 'dreamledger',
    capability_id: capability.id,
    name: capability.name,
    problem: demand,
    deliverable: capability.commercialization || 'Capability-derived deliverable requiring scope definition.',
    target_buyer: signal?.target_buyer || 'Buyer matching the observed demand signal.',
    price_proposal_nzd: prices,
    price_status: 'UNVERIFIED',
    payment_adapter: 'stripe',
    checkout_available: false,
    approval_required: true,
    public_execution: 'HUMAN_GATE_REQUIRED',
    evidence_status: 'UNVERIFIED',
    created_by: 'ELOHIM',
    provenance: {
      capability_id: capability.id,
      demand_signal_id: signal?.signal_id || null,
      source: 'BEC-PRIME/catalog/ip-capabilities.json'
    }
  };
}

function createCandidates(capabilities = [], demandSignals = []) {
  if (!Array.isArray(capabilities)) throw new TypeError('capabilities must be an array.');
  const signals = Array.isArray(demandSignals) ? demandSignals : [];
  return capabilities.map((capability, index) => createCandidate(capability, signals[index] || null));
}

module.exports = { createCandidate, createCandidates };
