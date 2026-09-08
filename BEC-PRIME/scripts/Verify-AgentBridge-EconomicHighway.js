'use strict';

const bridge = require('../runtime/AgentBridge');

const checks = [];
function check(name, pass, detail) {
  checks.push({ name, status: pass ? 'PASS' : 'FAIL', detail: detail || '' });
}

function main() {
  check('bridge schema', bridge.BRIDGE_SCHEMA_VERSION === 'BECK-AGENT-BRIDGE-1.2');
  check('event schema', bridge.EVENT_SCHEMA_VERSION === 'BECK-STRUCTURED-EVENT-1.1');
  check('routing lanes', ['discovery','evidence','evaluation','approval','execution','payment','fulfillment','reconciliation','arbitrage'].every(x => bridge.ROUTING_LANES.has(x)));

  const event = bridge.validateEventEnvelope({
    event_id: 'VERIFY_ECONOMIC_HIGHWAY_001',
    correlation_id: 'VERIFY_ECONOMIC_HIGHWAY',
    event_type: 'CANDIDATE_FOUND',
    agent: 'grok',
    lane: 'discovery',
    priority: 90,
    silo_id: 'SILO_GENERAL',
    source_system: 'grok',
    source_ref: 'verification',
    economic_intent: 'find_paid_problem',
    required_capabilities: ['demand_detection', 'offer_matching'],
    suggested_next_agents: ['truth_oracle', 'gauntlet'],
    ttl_seconds: 3600,
    claim: 'contract verification',
    confidence: 1
  });

  check('candidate envelope accepted', event.event_type === 'CANDIDATE_FOUND' && event.agent === 'grok');
  check('priority preserved', event.priority === 90);
  check('silo preserved', event.silo_id === 'SILO_GENERAL');
  check('economic intent preserved', event.economic_intent === 'find_paid_problem');
  check('capability fanout bounded', event.required_capabilities.length <= 20 && event.suggested_next_agents.length <= 12);
  check('expiry present', typeof event.expires_at === 'string');

  try {
    bridge.validateEventEnvelope({
      event_id: 'VERIFY_BAD_PAYMENT_LANE',
      correlation_id: 'VERIFY_BAD',
      event_type: 'PAYMENT_DETECTED',
      agent: 'system',
      lane: 'discovery'
    });
    check('payment lane guard', false, 'accepted invalid lane');
  } catch (err) {
    check('payment lane guard', /payment lane/i.test(err.message));
  }

  try {
    bridge.validateEventEnvelope({
      event_id: 'VERIFY_BAD_ACTION_LANE',
      correlation_id: 'VERIFY_BAD_ACTION',
      event_type: 'ACTION_EXECUTED',
      agent: 'system',
      lane: 'discovery'
    });
    check('execution lane guard', false, 'accepted invalid lane');
  } catch (err) {
    check('execution lane guard', /execution lane/i.test(err.message));
  }

  const failed = checks.filter(x => x.status === 'FAIL');
  const result = {
    schema: 'BEC-AGENT-BRIDGE-ECONOMIC-HIGHWAY-VERIFY/v1',
    status: failed.length ? 'FAIL' : 'PASS',
    checks,
    live_evidence_required: [
      'authenticated Grok -> production AgentBridge request',
      'duplicate event replay returns idempotent=true',
      'correlation retrieval returns ordered chain',
      'ACTION_EXECUTED without approval is rejected',
      'PAYMENT_DETECTED does not alter RA_000001',
      'production payment Truth Pipe independently verifies first stranger payment'
    ],
    checked_at: new Date().toISOString()
  };
  console.log(JSON.stringify(result, null, 2));
  if (failed.length) process.exitCode = 1;
}

main();
