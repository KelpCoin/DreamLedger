'use strict';

/**
 * Provider-neutral roles for the single canonical AgentBridge.
 * These profiles are routing contracts, not authority. The server remains the
 * final gatekeeper for event validation, approval, payment truth, and revenue.
 */

const AGENT_PROFILES = Object.freeze({
  grok: Object.freeze({
    role: 'discovery_and_evidence',
    lanes: ['discovery', 'evidence'],
    event_types: ['CANDIDATE_FOUND', 'EVIDENCE_ATTACHED'],
    next_agents: ['truth_oracle', 'gauntlet']
  }),
  claude: Object.freeze({
    role: 'delivery_and_commercial_review',
    lanes: ['evaluation', 'fulfillment'],
    event_types: ['DELIVERY_ASSESSMENT', 'COMMERCIAL_ATTACK'],
    next_agents: ['truth_oracle', 'gauntlet']
  }),
  chatgpt: Object.freeze({
    role: 'economic_evaluation_and_court',
    lanes: ['evaluation'],
    event_types: ['COURT_REVIEW', 'COURT_VERDICT'],
    next_agents: ['claude', 'grok', 'truth_oracle', 'gauntlet']
  }),
  luna: Object.freeze({
    role: 'court_and_adversarial_review',
    lanes: ['evaluation', 'evidence'],
    event_types: ['COURT_REVIEW', 'COURT_VERDICT'],
    next_agents: ['truth_oracle', 'gauntlet']
  }),
  deepseek: Object.freeze({
    role: 'specialist_proposal',
    lanes: ['evaluation'],
    event_types: ['ACTION_PROPOSED'],
    next_agents: ['gauntlet', 'human']
  }),
  monetizer: Object.freeze({
    role: 'commercial_packaging',
    lanes: ['evaluation', 'approval'],
    event_types: ['COMMERCIAL_ATTACK', 'ACTION_PROPOSED'],
    next_agents: ['gauntlet', 'human']
  }),
  humanizer: Object.freeze({
    role: 'customer_facing_copy',
    lanes: ['evaluation'],
    event_types: ['DELIVERY_ASSESSMENT'],
    next_agents: ['truth_oracle', 'human']
  }),
  truth_oracle: Object.freeze({
    role: 'claim_verification',
    lanes: ['evidence', 'evaluation', 'reconciliation'],
    event_types: ['EVIDENCE_ATTACHED', 'COURT_VERDICT', 'RECONCILIATION_COMPLETED'],
    next_agents: ['gauntlet', 'human']
  }),
  gauntlet: Object.freeze({
    role: 'adversarial_gate',
    lanes: ['evaluation', 'approval'],
    event_types: ['COMMERCIAL_ATTACK', 'COURT_REVIEW', 'COURT_VERDICT'],
    next_agents: ['human', 'monetizer']
  })
});

const COMMERCIAL_EVENT_RULES = Object.freeze({
  CANDIDATE_FOUND: { required_economic_intent: 'find_paid_problem' },
  DELIVERY_ASSESSMENT: { required_economic_intent: 'assess_existing_fulfillment' },
  COMMERCIAL_ATTACK: { required_economic_intent: 'attack_offer' },
  ACTION_PROPOSED: { required_economic_intent: 'prepare_approved_action' }
});

function profileFor(agent) {
  return AGENT_PROFILES[String(agent || '').toLowerCase()] || null;
}

function canEmit(agent, eventType, lane) {
  const profile = profileFor(agent);
  if (!profile) return false;
  return profile.event_types.includes(String(eventType || '').toUpperCase()) &&
    profile.lanes.includes(String(lane || '').toLowerCase());
}

function commercialEvidence({ offer_id, price_minor, currency = 'nzd', payment_ready = false, lattice_id = null }) {
  if (!offer_id) throw new Error('offer_id is required');
  if (!Number.isInteger(Number(price_minor)) || Number(price_minor) < 0) {
    throw new Error('price_minor must be a non-negative integer');
  }
  return {
    type: 'commercial_offer_reference',
    offer_id: String(offer_id),
    lattice_id: lattice_id == null ? null : String(lattice_id),
    price_minor: Number(price_minor),
    currency: String(currency).toLowerCase(),
    payment_ready: Boolean(payment_ready),
    authority: 'advisory_only'
  };
}

module.exports = {
  AGENT_PROFILES,
  COMMERCIAL_EVENT_RULES,
  profileFor,
  canEmit,
  commercialEvidence
};
