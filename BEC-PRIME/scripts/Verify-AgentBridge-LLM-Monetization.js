'use strict';

const assert = require('assert');
const bridge = require('../runtime/AgentBridge');
const { AgentBridgeClient } = require('../runtime/AgentBridgeClient');
const { AGENT_PROFILES, canEmit, commercialEvidence } = require('../runtime/AgentBridgeProfiles');

const checks = [];
function check(name, pass, detail = '') {
  checks.push({ name, status: pass ? 'PASS' : 'FAIL', detail });
}

function expect(name, fn) {
  try {
    fn();
    check(name, true);
  } catch (err) {
    check(name, false, err.message);
  }
}

function main() {
  expect('single canonical bridge', () => {
    assert.strictEqual(bridge.BRIDGE_SCHEMA_VERSION, 'BECK-AGENT-BRIDGE-1.2');
    assert.strictEqual(bridge.EVENT_SCHEMA_VERSION, 'BECK-STRUCTURED-EVENT-1.1');
  });

  for (const agent of ['grok', 'claude', 'chatgpt', 'luna', 'deepseek']) {
    expect(`${agent} profile exists`, () => {
      assert.ok(AGENT_PROFILES[agent]);
      assert.ok(AGENT_PROFILES[agent].lanes.length > 0);
      assert.ok(AGENT_PROFILES[agent].event_types.length > 0);
    });
  }

  expect('Grok discovery contract', () => assert.strictEqual(canEmit('grok', 'CANDIDATE_FOUND', 'discovery'), true));
  expect('Claude delivery contract', () => assert.strictEqual(canEmit('claude', 'DELIVERY_ASSESSMENT', 'evaluation'), true));
  expect('ChatGPT court contract', () => assert.strictEqual(canEmit('chatgpt', 'COURT_REVIEW', 'evaluation'), true));
  expect('Luna court contract', () => assert.strictEqual(canEmit('luna', 'COURT_VERDICT', 'evaluation'), true));
  expect('DeepSeek evidence contract', () => assert.strictEqual(canEmit('deepseek', 'EVIDENCE_ATTACHED', 'evidence'), true));

  expect('provider cannot emit outside its role', () => assert.strictEqual(canEmit('grok', 'ACTION_APPROVED', 'approval'), false));
  expect('commercial reference is advisory', () => {
    const ref = commercialEvidence({
      offer_id: 'AUT_0001',
      price_minor: 9900,
      currency: 'nzd',
      payment_ready: true,
      lattice_id: 'LAT-002'
    });
    assert.strictEqual(ref.authority, 'advisory_only');
    assert.strictEqual(ref.price_minor, 9900);
    assert.strictEqual(ref.payment_ready, true);
  });

  expect('client rejects agent spoofing', () => {
    const client = new AgentBridgeClient({ baseUrl: 'https://dreamledger.org', token: 'test', agent: 'grok' });
    assert.throws(() => client.emit({
      event_id: 'TEST_SPOOF',
      correlation_id: 'TEST_SPOOF',
      event_type: 'CANDIDATE_FOUND',
      agent: 'claude',
      lane: 'discovery'
    }), /must match client agent/);
  });

  expect('economic authority remains outside LLM client', () => {
    assert.strictEqual(typeof AgentBridgeClient.prototype.emit, 'function');
    assert.strictEqual(typeof AgentBridgeClient.prototype.commercialCandidate, 'function');
    assert.strictEqual(typeof AgentBridgeClient.prototype.approveAction, 'undefined');
    assert.ok(!Object.prototype.hasOwnProperty.call(AGENT_PROFILES.grok, 'payment_authority'));
  });

  const failed = checks.filter(x => x.status === 'FAIL');
  const result = {
    schema: 'BEC-AGENT-BRIDGE-LLM-MONETIZATION-VERIFY/v1',
    status: failed.length ? 'FAIL' : 'PASS',
    checks,
    live_proof_required: [
      'authenticated Grok request against production AgentBridge',
      'authenticated Claude request against production AgentBridge',
      'authenticated ChatGPT request against production AgentBridge',
      'authenticated Luna request against production AgentBridge',
      'authenticated DeepSeek request against production AgentBridge',
      'persisted event_id and correlation_id',
      'duplicate replay returns idempotent=true',
      'commercial candidate reaches Truth Oracle/Gauntlet without becoming a live offer',
      'human approval remains required before consequential execution',
      'real stranger payment remains the only RA_000001 authority'
    ],
    checked_at: new Date().toISOString()
  };
  console.log(JSON.stringify(result, null, 2));
  if (failed.length) process.exitCode = 1;
}

main();
