'use strict';

/**
 * Thin HTTP client for the single canonical DreamLedger AgentBridge.
 * No provider SDK is required. Grok, Claude, ChatGPT, Luna, DeepSeek and
 * internal workers can use the same wire contract without creating parallel
 * transport paths.
 */

const { canEmit, commercialEvidence, profileFor } = require('./AgentBridgeProfiles');

class AgentBridgeClient {
  constructor({ baseUrl, token, agent, timeoutMs = 15000 }) {
    this.baseUrl = String(baseUrl || '').replace(/\/$/, '');
    this.token = String(token || '');
    this.agent = String(agent || '').toLowerCase();
    this.timeoutMs = Number(timeoutMs) || 15000;
    if (!this.baseUrl) throw new Error('baseUrl is required');
    if (!profileFor(this.agent)) throw new Error(`unsupported bridge agent: ${this.agent}`);
  }

  async request(path, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const headers = {
        Accept: 'application/json',
        'x-dreamledger-agent-token': this.token,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {})
      };
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        headers,
        signal: controller.signal
      });
      const text = await response.text();
      let body;
      try { body = JSON.parse(text || '{}'); } catch { body = { raw: text }; }
      if (!response.ok) {
        const error = new Error(body.error || `AgentBridge HTTP ${response.status}`);
        error.status = response.status;
        error.body = body;
        throw error;
      }
      return body;
    } finally {
      clearTimeout(timer);
    }
  }

  manifest() {
    return this.request('/api/agent-bridge/manifest');
  }

  state() {
    return this.request('/api/agent-bridge/state');
  }

  nextJob() {
    return this.request('/api/agent-bridge/jobs/next');
  }

  getEvent(eventId) {
    return this.request(`/api/agent-bridge/events/${encodeURIComponent(eventId)}`);
  }

  getCorrelation(correlationId) {
    return this.request(`/api/agent-bridge/correlations/${encodeURIComponent(correlationId)}`);
  }

  async emit(event) {
    const eventType = String(event.event_type || '').toUpperCase();
    const lane = String(event.lane || 'discovery').toLowerCase();
    const agent = String(event.agent || this.agent).toLowerCase();
    if (agent !== this.agent) throw new Error('event agent must match client agent');
    if (!canEmit(agent, eventType, lane)) {
      throw new Error(`agent profile does not permit ${eventType} on ${lane} lane`);
    }
    return this.request('/api/agent-bridge/events', {
      method: 'POST',
      body: JSON.stringify({ ...event, agent, event_type: eventType, lane })
    });
  }

  candidate({ event_id, correlation_id, claim, subject_id, source_ref, confidence = 0.5, evidence = [], suggested_next_agents = null }) {
    return this.emit({
      event_id,
      correlation_id,
      event_type: 'CANDIDATE_FOUND',
      agent: this.agent,
      lane: 'discovery',
      silo_id: 'SILO_GENERAL',
      source_system: this.agent,
      source_ref: source_ref || null,
      economic_intent: 'find_paid_problem',
      subject_type: 'economic_candidate',
      subject_id: subject_id || '',
      claim,
      evidence,
      confidence,
      requested_action: 'route_to_truth_oracle_and_gauntlet',
      suggested_next_agents: suggested_next_agents || ['truth_oracle', 'gauntlet'],
      ttl_seconds: 86400
    });
  }

  commercialCandidate({ event_id, correlation_id, claim, offer_id, price_minor, currency = 'nzd', payment_ready = false, lattice_id = null, source_ref = null }) {
    return this.candidate({
      event_id,
      correlation_id,
      claim,
      subject_id: offer_id,
      source_ref,
      confidence: 0.5,
      evidence: [commercialEvidence({ offer_id, price_minor, currency, payment_ready, lattice_id })]
    });
  }

  deliveryAssessment({ event_id, correlation_id, claim, subject_id, evidence = [], confidence = 0.5 }) {
    return this.emit({
      event_id,
      correlation_id,
      event_type: 'DELIVERY_ASSESSMENT',
      agent: this.agent,
      lane: 'evaluation',
      silo_id: 'SILO_GENERAL',
      source_system: this.agent,
      subject_type: 'offer_candidate',
      subject_id: subject_id || '',
      claim,
      evidence,
      confidence,
      economic_intent: 'assess_existing_fulfillment',
      requested_action: 'route_to_truth_oracle_and_gauntlet',
      suggested_next_agents: ['truth_oracle', 'gauntlet'],
      ttl_seconds: 86400
    });
  }

  commercialAttack({ event_id, correlation_id, claim, subject_id, evidence = [], confidence = 0.5 }) {
    return this.emit({
      event_id,
      correlation_id,
      event_type: 'COMMERCIAL_ATTACK',
      agent: this.agent,
      lane: 'evaluation',
      silo_id: 'SILO_GENERAL',
      source_system: this.agent,
      subject_type: 'offer_candidate',
      subject_id: subject_id || '',
      claim,
      evidence,
      confidence,
      economic_intent: 'attack_offer',
      requested_action: 'gauntlet_review',
      suggested_next_agents: ['gauntlet', 'human'],
      ttl_seconds: 86400
    });
  }
}

module.exports = { AgentBridgeClient };
