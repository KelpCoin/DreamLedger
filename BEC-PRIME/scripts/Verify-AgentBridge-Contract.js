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
    event_id: 'bad', correlation_id: 'bad', event_type: 'CANDIDATE_FOUND', agent: 'not-an-allowed-agent'
  }), /agent not allowed|invalid agent/);

  assert.throws(() => bridge.validateEventEnvelope({
    event_id: 'bad-approval', correlation_id: 'bad-approval', event_type: 'ACTION_APPROVED', agent: 'claude'
  }), /ACTION_APPROVED requires human\/system/);

  const server = http.createServer((req, res) => bridge.handle(req, res));
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  try {
    const manifest = await request(port, '/api/agent-bridge/manifest');
    assert.equal(manifest.status, 200);
    assert.equal(manifest.json.schema_version, bridge.BRIDGE_SCHEMA_VERSION);
    assert.equal(manifest.json.schema_version, 'BECK-AGENT-BRIDGE-1.3');
    assert.equal(manifest.json.authentication_header, 'x-dreamledger-agent-token');
    assert.equal(manifest.json.external_actions, 'human_approval_required');
    assert.equal(manifest.json.economic_truth, 'Bridge activity is not revenue');
    assert.ok(manifest.json.work_routes.includes('/api/agent-bridge/events'));
    assert.ok(manifest.json.work_routes.includes('/api/agent-bridge/jobs'));
    assert.ok(manifest.json.work_routes.includes('/api/agent-bridge/correlations/:id'));
    assert.equal(manifest.json.work_routes.some(route => route.endsWith('/approve')), false);

    // Exercise the real job handler with a standalone HTTPS proxy and no Supabase URL.
    const names = ['SUPABASE_URL', 'AGENT_BRIDGE_PROXY_URL', 'DREAMLEDGER_AGENT_BRIDGE_TOKEN'];
    const original = Object.fromEntries(names.map(k => [k, process.env[k]]));
    const previousFetch = global.fetch;
    try {
      delete process.env.SUPABASE_URL;
      process.env.AGENT_BRIDGE_PROXY_URL = 'https://bridge.example.invalid/api';
      process.env.DREAMLEDGER_AGENT_BRIDGE_TOKEN = 'contract-fixture-token';
      assert.equal(bridge.configured(), true);
      let requests = 0;
      global.fetch = async (destination, options) => {
        requests++;
        assert.equal(destination, 'https://bridge.example.invalid/api');
        assert.equal(options.headers['x-dreamledger-agent-token'], 'contract-fixture-token');
        assert.equal(JSON.parse(options.body).path, 'rpc/claim_job');
        return { ok: true, status: 200, text: async () => 'null' };
      };
      const claim = await new Promise((resolve, reject) => {
        const req = http.request({
          hostname: '127.0.0.1', port, path: '/api/agent-bridge/jobs/claim',
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-dreamledger-agent-token': 'contract-fixture-token' }
        }, res => {
          let data = '';
          res.on('data', chunk => { data += chunk; });
          res.on('end', () => {
            try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
            catch (error) { reject(error); }
          });
        });
        req.once('error', reject);
        req.end(JSON.stringify({ worker_id: 'contract-worker', lease_seconds: 90 }));
      });
      assert.equal(claim.status, 200);
      assert.equal(claim.body.claimed, false);
      assert.equal(claim.body.reason, 'NO_JOB');
      assert.equal(requests, 1);
      delete process.env.DREAMLEDGER_AGENT_BRIDGE_TOKEN;
      assert.equal(bridge.configured(), false, 'no credentials, no work');
    } finally {
      global.fetch = previousFetch;
      for (const key of names) {
        if (original[key] === undefined) delete process.env[key];
        else process.env[key] = original[key];
      }
    }

    console.log(JSON.stringify({
      schema: 'BEC-AGENT-BRIDGE-CONTRACT-VERIFY/v2',
      status: 'PASS',
      manifest: 'PASS',
      event_contract: 'PASS',
      role_gate: 'PASS',
      consequential_action_gate: 'human_approval_required',
      provider_independent_job_claim: 'PASS',
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
