'use strict';

const assert = require('assert/strict');
const http = require('http');
const bridge = require('../runtime/AgentBridge');

async function request(port, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path, method: 'GET', headers }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(body); } catch {}
        resolve({ status: res.statusCode, headers: res.headers, body, json });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  assert.equal(bridge.configured(), true, 'agent bridge requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and DREAMLEDGER_AGENT_BRIDGE_TOKEN');
  const server = http.createServer((req, res) => bridge.handle(req, res));
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  try {
    const manifest = await request(port, '/api/agent-bridge/manifest');
    assert.equal(manifest.status, 200);
    assert.equal(manifest.json?.schema_version, 'BECK-AGENT-BRIDGE-1.0');
    assert.equal(manifest.json?.canonical_doorway, 'https://dreamledger.org/go');
    assert.equal(manifest.json?.external_actions, 'human_approval_required');

    const state = await request(port, '/api/agent-bridge/state', {
      'x-dreamledger-agent-token': process.env.DREAMLEDGER_AGENT_BRIDGE_TOKEN
    });
    assert.equal(state.status, 200, `state endpoint failed: ${state.body}`);
    assert.equal(state.json?.state?.status, 'OPEN', 'RA_000001 must remain OPEN during bridge verification');
    assert.equal(Number(state.json?.state?.verified_payment_count || 0), 0, 'synthetic bridge verification must not claim a payment');
    assert.equal(Number(state.json?.state?.revenue_nzd || 0), 0, 'synthetic bridge verification must not claim revenue');

    console.log(JSON.stringify({
      schema: 'BEC-AGENT-BRIDGE-LIVE-VERIFY/v1',
      status: 'PASS',
      manifest: 'PASS',
      state_read: 'PASS',
      ra000001_status: state.json.state.status,
      verified_payment_count: state.json.state.verified_payment_count,
      revenue_nzd: state.json.state.revenue_nzd,
      note_write_performed: false,
      checked_at: new Date().toISOString()
    }, null, 2));
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(err => {
  console.error(JSON.stringify({ schema: 'BEC-AGENT-BRIDGE-LIVE-VERIFY/v1', status: 'FAIL', error: err.message }, null, 2));
  process.exitCode = 1;
});
