'use strict';

/*
 * Elohim -> Gauntlet -> Gold Button bridge.
 *
 * This is a thin adapter over existing DreamLedger substrate:
 *   - approved offers
 *   - demand radar
 *   - CandidateGauntlet
 *   - existing Stripe payment links
 *
 * It does not create a product, buyer, payment, or fulfillment event.
 * It produces a single approval-gated conversion descriptor.
 */

const fs = require('fs');
const path = require('path');
const { run: runGauntlet } = require('../gauntlet/CandidateGauntlet');

const ROOT = path.resolve(__dirname, '..');
const APPROVED = path.join(ROOT, 'catalog', 'offers', 'approved.json');
const DEMAND_RADAR = path.join(ROOT, '..', 'ops', 'demand', 'latest.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function slug(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function loadOffer(offerId) {
  const source = readJson(APPROVED);
  const offer = (Array.isArray(source.approved) ? source.approved : [])
    .find(x => x.offer_id === offerId);
  if (!offer) throw new Error('Approved offer not found: ' + offerId);
  return offer;
}

function demandEvidence(offer) {
  if (!fs.existsSync(DEMAND_RADAR)) {
    return {
      state: 'UNKNOWN',
      reason: 'Demand radar is unavailable'
    };
  }

  const radar = readJson(DEMAND_RADAR);
  const target = slug(offer.name);
  const hit = Array.isArray(radar.active)
    ? radar.active.find(x => slug(x.slug || x.name) === target)
    : null;

  if (!hit) {
    return {
      state: 'UNKNOWN',
      reason: 'No direct demand-radar observation matches this approved offer'
    };
  }

  const signals = Array.isArray(hit.signals) ? hit.signals : [];
  return {
    state: 'OBSERVED',
    provenance: 'ops/demand/latest.json',
    observed_at: radar.generated_at || null,
    observed_score: Number(hit.score) || null,
    signal_count: signals.length,
    signal_volume: signals.reduce((sum, x) => sum + Math.max(0, Number(x.count) || 0), 0)
  };
}

function toGauntletCandidate(offer, proposal) {
  const p = proposal || {};
  return {
    offer_id: offer.offer_id,
    name: p.name || offer.name,
    problem: p.problem || offer.problem,
    target_buyer: p.target_buyer || offer.target_buyer,
    deliverable: p.deliverable || offer.deliverable,
    delivery_mechanism: p.delivery_mechanism || offer.delivery_mechanism,
    price: Number(p.price || offer.price),
    currency: p.currency || offer.currency,
    payment_adapter: p.payment_adapter || offer.payment_adapter,
    checkout_route: p.checkout_route || offer.checkout_route,
    approval_required: true,
    checkout_available: false,
    status: 'APPROVED_OFFER_HUMAN_GATE',
    proof_of_delivery: p.proof_of_delivery || offer.proof_of_delivery,
    verification_rules: p.verification_rules || offer.verification_rules,
    provenance: {
      private_material: 'excluded',
      approved_offer: 'BEC-PRIME/catalog/offers/approved.json',
      demand_signal: 'ops/demand/latest.json'
    },
    silo: offer.silo,
    kill_condition: p.kill_condition || 'Any contradiction in payment, attribution, fulfillment, evidence, or silo boundary.'
  };
}

function buildGoldButton(offer, proposal) {
  const candidate = toGauntletCandidate(offer, proposal);
  const gauntlet = runGauntlet(candidate);
  const demand = demandEvidence(offer);

  const button = {
    schema: 'dreamledger/elohim-gauntlet-gold-button/v1',
    offer_id: offer.offer_id,
    product_id: offer.product_id,
    title: proposal?.button_title || offer.name,
    price_nzd: Number(offer.price),
    currency: offer.currency,
    payment_url: offer.payment_link_url,
    payment_link_status: offer.payment_link_status,
    demand: demand,
    elohim: {
      proposal_present: Boolean(proposal),
      role: 'create_refine_repair',
      authority: 'none'
    },
    gauntlet: {
      verdict: gauntlet.status,
      proof: gauntlet,
      authority: 'judge_only'
    },
    publication: {
      state: gauntlet.status === 'PASS'
        ? 'READY_FOR_HUMAN_APPROVAL'
        : 'BLOCKED',
      approval_required: true,
      public_dispatch_performed: false
    },
    economic_truth: {
      verified_external_revenue_nzd: 0,
      settled_external_payments: 0,
      independent_external_buyers: 0
    }
  };

  return button;
}

module.exports = {
  loadOffer,
  demandEvidence,
  toGauntletCandidate,
  buildGoldButton
};

if (require.main === module) {
  const offerId = process.argv[2] || 'OFFER-CMD-DIAG-29-NZD';
  const proposalPath = process.argv[3] || null;
  const proposal = proposalPath ? readJson(proposalPath) : {};
  const offer = loadOffer(offerId);
  console.log(JSON.stringify(buildGoldButton(offer, proposal), null, 2));
}
