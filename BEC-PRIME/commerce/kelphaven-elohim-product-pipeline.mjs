'use strict';

import crypto from 'node:crypto';
import { proposePrice } from './kelphaven-marketplace-contract.mjs';
import createModule from '../council/ElohimCreate.js';
import productValidator from '../elohim/validateElohimProduct.js';
import candidateGauntlet from '../gauntlet/CandidateGauntlet.js';

const { createCandidate } = createModule;
const { candidateToDraftProduct, validateElohimCandidate } = productValidator;
const { run: runCandidateGauntlet } = candidateGauntlet;
const HASH_RE = /^[a-f0-9]{64}$/i;

function hold(reason, errors = []) {
  return {
    schema: 'kelphaven/elohim-product-pipeline/v1',
    status: 'HELD_NO_PRICE_EVIDENCE',
    reason,
    errors,
    price_nzd: null,
    gauntlet: { status: 'NOT_RUN', verdict: 'HOLD' },
    may_publish: false,
    may_charge: false,
    external_evidence_status: 'UNVERIFIED'
  };
}

function normalizedEvidence(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, errors: ['PRICE_EVIDENCE_REQUIRED'], items: [] };
  }
  const errors = [];
  const normalized = items.map((item, index) => {
    const source = String(item?.source || '').trim();
    const retrievedAt = String(item?.retrievedAt || item?.retrieved_at || '').trim();
    const kind = String(item?.kind || '').trim();
    const sha256 = String(item?.sha256 || '').trim().toLowerCase();
    if (!source) errors.push('EVIDENCE_' + index + '_SOURCE_REQUIRED');
    if (!retrievedAt || !Number.isFinite(Date.parse(retrievedAt))) errors.push('EVIDENCE_' + index + '_TIMESTAMP_INVALID');
    if (!kind) errors.push('EVIDENCE_' + index + '_KIND_REQUIRED');
    if (!HASH_RE.test(sha256)) errors.push('EVIDENCE_' + index + '_SHA256_REQUIRED');
    return { source, retrievedAt, retrieved_at: retrievedAt, kind, sha256 };
  });
  return { ok: errors.length === 0, errors, items: normalized };
}

/**
 * Product drafting and economic pricing are one gated operation.
 * A source reference and SHA-256 are integrity metadata, not proof that the
 * referenced market fact is true. External evidence remains UNVERIFIED until
 * independently retrieved and checked. This function never publishes or charges.
 */
function runElohimProductPipeline(input = {}, options = {}) {
  const product = input.product_candidate || input.product || {};
  const pricing = input.pricing || product.pricing || {};
  if (!product || typeof product !== 'object' || !product.id || !product.name) {
    return hold('PRODUCT_ID_AND_NAME_REQUIRED', ['PRODUCT_ID_AND_NAME_REQUIRED']);
  }

  const evidence = normalizedEvidence(pricing.evidence);
  if (!evidence.ok) return hold('PRICE_EVIDENCE_INCOMPLETE', evidence.errors);

  const priceProposal = proposePrice({
    sku: product.sku || product.id,
    siloId: product.silo || product.silo_id || 'digital_products',
    currency: pricing.currency || 'NZD',
    unitCostNzd: Number(pricing.unit_cost_nzd ?? pricing.unitCostNzd),
    transactionCostNzd: Number(pricing.transaction_cost_nzd ?? pricing.transactionCostNzd ?? 0),
    fulfilmentCostNzd: Number(pricing.fulfilment_cost_nzd ?? pricing.fulfilmentCostNzd ?? 0),
    taxReserveNzd: Number(pricing.tax_reserve_nzd ?? pricing.taxReserveNzd ?? 0),
    targetMarginPct: Number(pricing.target_margin_pct ?? pricing.targetMarginPct),
    evidence: evidence.items
  });
  if (priceProposal.status !== 'PROPOSED_NOT_PUBLISHED') {
    return hold('PRICE_PROPOSAL_REJECTED', priceProposal.errors || ['PRICE_PROPOSAL_REJECTED']);
  }

  const sourceEvidence = evidence.items.map((item) => ({
    source: item.source,
    retrieved_at: item.retrieved_at,
    kind: item.kind,
    sha256: item.sha256
  }));
  const evidenceHash = crypto.createHash('sha256')
    .update(JSON.stringify(sourceEvidence))
    .digest('hex');

  let candidate;
  try {
    candidate = createCandidate({
      id: String(product.id),
      name: String(product.name),
      silo: String(product.silo || product.silo_id || 'digital_products'),
      price: priceProposal.priceNzd,
      summary: String(product.problem || product.description || 'Product proposal requires external demand validation.'),
      commercialization: String(product.description || product.deliverable || product.name)
    }, input.signal || null);
  } catch (err) {
    return hold('ELOHIM_CANDIDATE_INVALID', [String(err.message || err)]);
  }

  candidate.status = 'ELOHIM_CREATED_CANDIDATE';
  candidate.price_proposal_nzd = [priceProposal.priceNzd];
  candidate.price_status = 'SOURCE_REFERENCED_PROPOSAL_NOT_VERIFIED';
  candidate.pricing_policy_version = 'kelphaven-cost-plus-v1';
  candidate.pricing = {
    currency: 'NZD',
    unit_cost_nzd: Number(pricing.unit_cost_nzd ?? pricing.unitCostNzd),
    transaction_cost_nzd: Number(pricing.transaction_cost_nzd ?? pricing.transactionCostNzd ?? 0),
    fulfilment_cost_nzd: Number(pricing.fulfilment_cost_nzd ?? pricing.fulfilmentCostNzd ?? 0),
    tax_reserve_nzd: Number(pricing.tax_reserve_nzd ?? pricing.taxReserveNzd ?? 0),
    cost_floor_nzd: priceProposal.costFloorNzd,
    target_margin_pct: Number(pricing.target_margin_pct ?? pricing.targetMarginPct),
    estimated_margin_pct: priceProposal.estimatedMarginPct,
    price_proposal_id: 'PRICE-' + evidenceHash.slice(0, 20).toUpperCase()
  };
  candidate.pricing_evidence = sourceEvidence;
  candidate.provenance = {
    ...candidate.provenance,
    private_material: 'excluded',
    pricing_evidence_sha256: evidenceHash,
    price_proposal_id: candidate.pricing.price_proposal_id
  };

  const candidateValidation = validateElohimCandidate(candidate);
  if (!candidateValidation.ok) {
    return hold('ELOHIM_CANDIDATE_VALIDATION_FAILED', candidateValidation.errors.map((e) => e.code));
  }

  let draftProduct;
  try {
    draftProduct = candidateToDraftProduct(candidate, {
      sku: String(product.sku || product.id),
      price: priceProposal.priceNzd,
      price_unit: 'major',
      status: 'draft',
      checkout_available: false,
      checkout_url: null,
      sale_mode: 'disabled',
      commercial_truth: {
        approval_required: true,
        sellable: false,
        reason: 'Kelphaven price proposal requires independent Gauntlet evaluation and explicit human approval.'
      },
      pricing_policy_version: 'kelphaven-cost-plus-v1',
      pricing_evidence: sourceEvidence,
      pricing_evidence_sha256: evidenceHash,
      cost_floor_nzd: priceProposal.costFloorNzd,
      estimated_margin_pct: priceProposal.estimatedMarginPct
    });
  } catch (err) {
    return hold('DRAFT_PRODUCT_VALIDATION_FAILED', [String(err.message || err)]);
  }

  const gauntletInput = {
    offer_id: candidate.id,
    name: candidate.name,
    problem: candidate.problem,
    target_buyer: candidate.target_buyer,
    deliverable: candidate.deliverable,
    delivery_mechanism: 'defined_digital_or_physical_fulfillment_required',
    price: priceProposal.priceNzd,
    currency: 'NZD',
    payment_adapter: 'stripe',
    checkout_route: '/api/offer-checkout/create',
    approval_required: true,
    checkout_available: false,
    status: 'CANDIDATE',
    proof_of_delivery: { required: true, receipt_required: true },
    verification_rules: [
      'pricing_evidence_hashes_present',
      'price_at_or_above_cost_floor',
      'seller_identity_verified_before_sale',
      'silo_boundary_verified_before_sale',
      'checkout_provider_verified_before_sale',
      'fulfillment_and_delivery_receipt_required'
    ],
    provenance: candidate.provenance,
    silo: candidate.silo,
    kill_condition: 'missing_or_contradictory_price_evidence_or_unfulfillable_offer',
    pricing_evidence_required: true,
    pricing_evidence: sourceEvidence,
    pricing_evidence_sha256: evidenceHash,
    pricing_policy_version: 'kelphaven-cost-plus-v1',
    price_cost_floor_nzd: priceProposal.costFloorNzd,
    price_proposal_id: candidate.pricing.price_proposal_id
  };
  const gauntletProof = runCandidateGauntlet(gauntletInput, options.proofPath || undefined);
  const passed = gauntletProof.status === 'PASS';

  return {
    schema: 'kelphaven/elohim-product-pipeline/v1',
    status: passed ? 'READY_FOR_HUMAN_REVIEW' : 'HELD_GAUNTLET_REJECTED',
    product_id: candidate.id,
    sku: String(product.sku || product.id),
    silo: candidate.silo,
    price_nzd: priceProposal.priceNzd,
    currency: 'NZD',
    pricing: priceProposal,
    pricing_evidence_sha256: evidenceHash,
    candidate,
    draft_product: { ...draftProduct, status: 'draft', checkout_available: false },
    gauntlet: {
      status: gauntletProof.status,
      checks: gauntletProof.checks,
      candidate_hash: gauntletProof.candidate_hash,
      public_execution: gauntletProof.public_execution
    },
    may_publish: false,
    may_charge: false,
    external_evidence_status: 'UNVERIFIED',
    independent_market_validation: 'NOT_PERFORMED',
    human_approval_required: true
  };
}

export { runElohimProductPipeline, normalizedEvidence };
