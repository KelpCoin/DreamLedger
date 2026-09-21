'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const policy = require('../governance/GovernancePolicy.json');
const firewall = require('./AuthorizationFirewall');

test('authorization firewall denies by default', () => {
  const r = firewall.issue(policy,{action:'publish',transition_id:'t',capability:'offer:publish',expires_at:new Date(Date.now()+60000).toISOString(),max_spend_nzd:0,max_external_actions:1});
  assert.equal(r.decision,'ALLOW');
});

test('authorization firewall denies expired capability', () => {
  const r = firewall.issue(policy,{action:'publish',transition_id:'t',capability:'offer:publish',expires_at:'2000-01-01T00:00:00Z',max_spend_nzd:0,max_external_actions:1});
  assert.equal(r.decision,'DENY');
  assert.ok(r.failures.includes('valid_expiry_required'));
});

test('authorization firewall denies kill state', () => {
  const r = firewall.issue(policy,{action:'publish',transition_id:'t',capability:'offer:publish',expires_at:new Date(Date.now()+60000).toISOString(),max_spend_nzd:0,max_external_actions:1},{kill_state:'TRIPPED'});
  assert.equal(r.decision,'DENY');
  assert.ok(r.failures.includes('kill_switch'));
});
