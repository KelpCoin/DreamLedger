'use strict';

const crypto = require('crypto');

function stableId(parts) {
  return crypto.createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 16).toUpperCase();
}

function buildCommercialPath({ capability, demand, prospect, offer, fulfillment }) {
  if (!capability?.id) throw new TypeError('capability.id is required');
  if (!demand?.id || !demand?.source_url) throw new TypeError('demand.id and demand.source_url are required');
  if (!prospect?.name) throw new TypeError('prospect.name is required');
  if (!offer?.name || !Number.isFinite(Number(offer.price_nzd))) throw new TypeError('offer.name and offer.price_nzd are required');

  const id = 'ELOHIM-PATH-' + stableId([capability.id, demand.id, prospect.name, offer.name]);

  return {
    id,
    schema_version: 'BEC-ELOHIM-COMMERCIAL-PATH-1.0',
    state: 'HUMAN_GATE_REQUIRED',
    truth_status: 'UNVERIFIED',
    capability: {
      id: capability.id,
      name: capability.name,
      deliverable: capability.commercialization || null
    },
    demand: {
      id: demand.id,
      title: demand.title,
      source_url: demand.source_url,
      evidence: demand.evidence || []
    },
    prospect: {
      name: prospect.name,
      basis: prospect.basis,
      buyer_status: 'PROSPECT_HYPOTHESIS'
    },
    offer: {
      name: offer.name,
      price_nzd: Number(offer.price_nzd),
      price_status: 'UNVERIFIED',
      checkout_status: offer.checkout_url ? 'AVAILABLE' : 'NOT_READY',
      checkout_url: offer.checkout_url || null
    },
    message: {
      status: 'DRAFT_READY',
      text: offer.message || null,
      send_status: 'NOT_SENT'
    },
    fulfillment: {
      deliverable: fulfillment.deliverable,
      procedure: fulfillment.procedure || [],
      evidence_required: fulfillment.evidence_required || []
    },
    gates: {
      public_contact: 'HUMAN_APPROVAL_REQUIRED',
      financial_action: 'HUMAN_APPROVAL_REQUIRED',
      payment_settlement: 'WAIT_FOR_EXTERNAL_EVENT',
      truth_verification: 'WAIT_FOR_EVIDENCE_JOIN'
    },
    kill_condition: offer.kill_condition || 'Kill if prospect confirms no relevant need or scope cannot be fulfilled as offered.',
    next_action: 'HUMAN_REVIEW_MESSAGE_AND_PROSPECT'
  };
}

module.exports = { buildCommercialPath };
