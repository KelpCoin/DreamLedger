'use strict';

const crypto = require('crypto');

const TOOLS = Object.freeze([
  'dl_read_cartridge',
  'dl_read_inventory',
  'dl_read_ledger',
  'dl_propose_offer',
  'dl_verify_proof',
  'dl_propose_checkout'
]);

const TOOL_MODES = Object.freeze({
  dl_read_cartridge: 'READ_ONLY',
  dl_read_inventory: 'READ_ONLY',
  dl_read_ledger: 'READ_ONLY',
  dl_propose_offer: 'PROPOSAL_ONLY',
  dl_verify_proof: 'READ_ONLY',
  dl_propose_checkout: 'PROPOSAL_ONLY'
});

const DECISIONS = Object.freeze([
  'AUTONOMOUS_ALLOWED',
  'SUPERVISED_REQUIRED',
  'HUMAN_APPROVAL_REQUIRED',
  'BLOCKED'
]);

function stable(value) {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + stable(value[k])).join(',') + '}';
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function classifyProposal(proposal) {
  if (!proposal || typeof proposal !== 'object') return { decision: 'BLOCKED', reason: 'proposal_missing' };
  if (proposal.execute === true || proposal.approve === true || proposal.publish === true) {
    return { decision: 'BLOCKED', reason: 'agent_authority_forbidden' };
  }
  if (!TOOLS.includes(String(proposal.tool || ''))) return { decision: 'BLOCKED', reason: 'tool_not_allowlisted' };

  const mode = TOOL_MODES[proposal.tool];
  if (mode === 'READ_ONLY') return { decision: 'AUTONOMOUS_ALLOWED', reason: 'read_only_tool' };
  if (mode === 'PROPOSAL_ONLY') return { decision: 'HUMAN_APPROVAL_REQUIRED', reason: 'proposal_requires_court_authority' };
  return { decision: 'BLOCKED', reason: 'unknown_tool_mode' };
}

function evaluate(proposal, context) {
  const c = context || {};
  if (c.truth_status === 'CONTRADICTED' || c.truth_status === 'STALE') {
    return { decision: 'BLOCKED', reason: 'invalid_or_stale_evidence' };
  }
  if (c.gauntlet_status && c.gauntlet_status !== 'PASS') {
    return { decision: 'BLOCKED', reason: 'gauntlet_not_passed' };
  }
  if (c.silo_allowed === false) return { decision: 'BLOCKED', reason: 'cross_silo_access_denied' };
  if (c.credentials_requested === true || c.policy_change === true || c.destructive_action === true) {
    return { decision: 'BLOCKED', reason: 'critical_capability_forbidden' };
  }

  const result = classifyProposal(proposal);
  return {
    decision: DECISIONS.includes(result.decision) ? result.decision : 'BLOCKED',
    reason: result.reason,
    proposal_hash: sha256(stable(proposal))
  };
}

function assertConstitution() {
  const failures = [];
  if (TOOLS.length !== 6) failures.push('tool_count_must_equal_six');
  for (const name of TOOLS) {
    if (!['READ_ONLY', 'PROPOSAL_ONLY'].includes(TOOL_MODES[name])) failures.push('dangerous_tool_mode:' + name);
  }
  return { status: failures.length ? 'FAIL' : 'PASS', failures };
}

module.exports = { TOOLS, TOOL_MODES, DECISIONS, classifyProposal, evaluate, assertConstitution, stable, sha256 };
