'use strict';

const assert = require('assert/strict');
const http = require('http');
const bridge = require('../runtime/AgentBridge');

function request(port, path) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path, method: 'GET' }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(body); } catch {}
        resolve({ status: res.statusCode, json });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  assert.equal(typeof bridge.handle, 'function');
  assert.equal(typeof bridge.validateEventEnvelope, 'function');
  assert.equal(bridge.STRUCTURED_EVENT_TYPES.has('CANDIDATE_FOUND'), true);
  assert.equal(bridge.STRUCTURED_EVENT_TYPES.has('COURT_VERDICT'), true);
  assert.equal(bridge.STRUCTURED_EVENT_TYPES.has('ACTION_APPROVED'), true);
  assert.equal(bridge.ALLOWED_AGENTS.has('grok'), true);
  assert.equal(bridge.ALLOWED_AGENTS.has('claude'), true);
  assert.equal(bridge.ALLOWED_AGENTS.has('chatgpt'), true);
  assert.equal(bridge.ALLOWED_AGENTS.has('truth_oracle'), true);
  assert.equal(bridge.ALLOWED_AGENTS.has('gauntlet'), true);

  const event = bridge.validateEventEnvelope({
    event_id: 'contract-test-event',
    correlation_id: 'contract-test-correlation',
    event_type: 'CANDIDATE_FOUND',
    agent: 'grok',
    subject_type: 'economic_candidate',
    subject_id: 'contract-test-candidate',
    claim: 'contract validation only',
    confidence: 0.9,
    evidence: []
  });
  assert.equal(event.event_type, 'CANDIDATE_FOUND');
  assert.equal(event.agent, 'grok');
  assert.equal(event.correlation_id, 'contract-test-correlation');

  assert.throws(() => bridge.validateEventEnvelope({
    event_id: 'bad', correlation_id: 'bad', event_type: 'CANDIDATE_FOUND', agent: 'claude'
  }), /may only be created by grok/);

  const server = http.createServer((req, res) => bridge.handle(req, res));
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  try {
    const manifest = await request(port, '/api/agent-bridge/manifest');
    assert.equal(manifest.status, 200);
    assert.equal(manifest.json.schema_version, bridge.BRIDGE_SCHEMA_VERSION);
    assert.equal(manifest.json.schema_version, 'BECK-AGENT-BRIDGE-1.3');
    assert.equal(manifest.json.authentication, 'x-dreamledger-agent-token');
    assert.equal(manifest.json.external_actions, 'policy_gated');
    assert.equal(manifest.json.payment_truth, 'RA_000001 requires independently verified external payment');
    assert.equal(manifest.json.endpoints.events.path, '/api/agent-bridge/events');
    assert.equal(manifest.json.endpoints.correlation.path, '/api/agent-bridge/correlations/:id');
    assert.equal(manifest.json.endpoints.approve_action.path, '/api/agent-bridge/actions/:id/approve');

    console.log(JSON.stringify({
      schema: 'BEC-AGENT-BRIDGE-CONTRACT-VERIFY/v2',
      status: 'PASS',
      manifest: 'PASS',
      event_contract: 'PASS',
      role_gate: 'PASS',
      consequential_action_gate: 'policy_gated',
      note_write_performed: false,
      checked_at: new Date().toISOString()
    }, null, 2));
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(err => {
  console.error(JSON.stringify({ schema: 'BEC-AGENT-BRIDGE-CONTRACT-VERIFY/v2', status: 'FAIL', error: err.message }, null, 2));
  process.exitCode = 1;
});
