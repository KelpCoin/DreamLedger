'use strict';

const crypto = require('crypto');
const {
  validateElohimCandidate,
  normalizeSilo
} = require('../elohim/validateElohimProduct');

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
    return capability.tiers.map(t => Number(t.price)).filter(p => Number.isFinite(p) && p > 0);
  }
  if (capability.price !== undefined && capability.price !== null && capability.price !== '' &&
      Number.isFinite(Number(capability.price)) && Number(capability.price) > 0) {
    return [Number(capability.price)];
  }
  return [];
}

function resolveSilo(capability) {
  const raw = capability.silo || capability.category || 'digital_products';
  const silo = normalizeSilo(raw);
  // Host label maps to commercial digital silo for product candidates
  if (!silo || silo === 'dreamledger') return 'digital_products';
  return silo;
}

function createCandidate(capability, signal = null) {
  if (!capability?.id || !capability?.name) {
    throw new TypeError('ElohimCreate requires capability.id and capability.name.');
  }

  const prices = priceProposal(capability);
  const demand = signal?.demand || signal?.problem || capability.summary || 'Customer problem to be validated externally.';

  const candidate = {
    id: stableId(capability, signal),
    schema_version: 'BEC-ELOHIM-CREATED-CANDIDATE-1.0',
    status: prices.length ? 'ELOHIM_CREATED_CANDIDATE' : 'UNPRICED_HELD',
    silo: resolveSilo(capability),
    capability_id: capability.id,
    name: capability.name,
    problem: demand,
    deliverable: capability.commercialization || 'Capability-derived deliverable requiring scope definition.',
    target_buyer: signal?.target_buyer || 'Buyer matching the observed demand signal.',
    price_proposal_nzd: prices,
    price_status: prices.length ? 'UNVERIFIED' : 'HELD_MISSING_PRICE_EVIDENCE',
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

  if (!prices.length) {
    candidate.validation = {
      ok: false,
      errors: [{ code: 'PRICE_EVIDENCE_REQUIRED', message: 'No source-backed price was supplied. Route through Kelphaven Elohim pricing pipeline; do not invent a default.' }],
      warnings: [],
      validated_at: new Date().toISOString(),
      schema: 'elohim-candidate.schema.json'
    };
    return candidate;
  }

  const validation = validateElohimCandidate(candidate);
  candidate.validation = {
    ok: validation.ok,
    errors: validation.errors,
    warnings: validation.warnings,
    validated_at: new Date().toISOString(),
    schema: 'elohim-candidate.schema.json'
  };

  if (!validation.ok) {
    candidate.status = 'INVALID';
    const err = new TypeError(
      `Elohim candidate failed schema validation: ${validation.errors.map(e => e.code).join(', ')}`
    );
    err.candidate = candidate;
    err.validation = validation;
    throw err;
  }

  return candidate;
}

function createCandidates(capabilities = [], demandSignals = []) {
  if (!Array.isArray(capabilities)) throw new TypeError('capabilities must be an array.');
  const signals = Array.isArray(demandSignals) ? demandSignals : [];
  return capabilities.map((capability, index) => createCandidate(capability, signals[index] || null));
}

module.exports = { createCandidate, createCandidates, resolveSilo };
