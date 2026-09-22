'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { wsjf, authority } = require('./EconomicSuperintendent');

test('WSJF ranks high value and urgent small work first', () => {
  assert.equal(wsjf({business_value:13,time_criticality:13,risk_reduction:8,job_size:2}),17);
});

test('public actions require escalation', () => {
  assert.equal(authority({action:'PUBLIC_POST',public:true}), 'MUST_ESCALATE');
});

test('forbidden actions cannot execute', () => {
  const policy = require('./TOOL-POLICY.json');
  assert.ok(policy.forbidden_actions.includes('WITHDRAW_MONEY'));
});
