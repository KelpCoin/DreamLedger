'use strict';

const governance = require('./GovernanceState');
const ledger = require('./Ledger');
const gov = require('../governance/GovernedExecution');
const policy = require('../governance/GovernancePolicy.json');

function executeTransition(input, runtime = {}) {
  const state = governance.status();
  const result = gov.evaluateTransition(policy, input, { ...runtime, kill_state: state.kill_state });
  const eventPayload = { transition: result.transition, decision: result.decision, policy_version: result.policy_version, checks: result.checks };
  const event = ledger.appendEventIdempotent({
    event_id: 'transition_' + result.transition.transition_id,
    graph_id: 'BEC-ECONOMIC', branch_id: result.transition.entity_id, node_id: result.transition.transition_name,
    event_type: result.decision === 'ADMIT' ? 'TRANSITION_ADMITTED' : 'TRANSITION_REJECTED', silo: 'dreamledger',
    actor: { type: 'governance', id: result.transition.requested_by }, payload: eventPayload,
    result: result.decision === 'ADMIT' ? 'PASS' : 'FAIL'
  });
  return { ...result, ledger_event: event.event, idempotent: event.idempotent };
}
module.exports = { executeTransition, policy };
