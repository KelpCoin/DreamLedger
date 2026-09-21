'use strict';

const crypto = require('crypto');
const TERMINAL = new Set(['TRIPPED','FROZEN']);
const ACTIONS = new Set(['publish','send','purchase','refund','delete','credential_access']);

function issue(policy, request, context = {}) {
  const action = String(request?.action || '').toLowerCase();
  const failures = [];
  const kill = String(context.kill_state || '').toUpperCase();
  if (kill && TERMINAL.has(kill)) failures.push('kill_switch');
  if (policy?.authorization?.default !== 'DENY') failures.push('policy_not_default_deny');
  if (!ACTIONS.has(action)) failures.push('action_not_allowlisted');
  if (!request?.transition_id) failures.push('transition_id_required');
  if (!request?.capability) failures.push('capability_required');
  if (!request?.expires_at || Date.parse(request.expires_at) <= Date.now()) failures.push('valid_expiry_required');

  const requestedSpend = Number(request?.max_spend_nzd ?? 0);
  const policySpend = Number(policy?.blast_radius?.max_spend_nzd ?? 0);
  if (!Number.isFinite(requestedSpend) || requestedSpend < 0 || requestedSpend > policySpend) failures.push('spend_limit_exceeded');

  const requestedActions = Number(request?.max_external_actions ?? 1);
  const policyActions = Number(policy?.blast_radius?.max_external_actions ?? 0);
  if (!Number.isSafeInteger(requestedActions) || requestedActions < 1 || requestedActions > policyActions) failures.push('action_limit_exceeded');

  if (failures.length) return { decision:'DENY', authorization_id:null, failures };

  const authorization_id = 'authz_' + crypto.randomUUID();
  return {
    decision:'ALLOW',
    authorization_id,
    failures:[],
    token:{
      authorization_id,
      transition_id:String(request.transition_id),
      action,
      capability:String(request.capability),
      policy_version:String(policy.policy_version),
      issued_at:new Date().toISOString(),
      expires_at:new Date(request.expires_at).toISOString(),
      max_spend_nzd:requestedSpend,
      max_external_actions:requestedActions
    }
  };
}

function revoke(token, reason='revoked') {
  return {
    authorization_id: token?.authorization_id || null,
    state:'REVOKED',
    reason:String(reason),
    revoked_at:new Date().toISOString()
  };
}

module.exports = { issue, revoke, ACTIONS:[...ACTIONS] };
