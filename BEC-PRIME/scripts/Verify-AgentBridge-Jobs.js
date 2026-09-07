'use strict';

const assert = require('assert/strict');
const bridge = require('../runtime/AgentBridge');

function response(status, data) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() { return JSON.stringify(data); }
  };
}

function invoke(req) {
  return new Promise((resolve, reject) => {
    const headers = {};
    const res = {
      writableEnded: false,
      writeHead(status, values) { this.status = status; this.headers = values; },
      end(body) { this.body = body; this.writableEnded = true; resolve({ status: this.status, headers: this.headers, json: JSON.parse(body) }); }
    };
    Promise.resolve(bridge.handle(req, res)).catch(reject);
  });
}

async function main() {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  process.env.DREAMLEDGER_AGENT_BRIDGE_TOKEN = 'bridge-test-token';

  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    assert.equal(options.headers.Authorization, 'Bearer test-service-role-key');
    assert.equal(options.headers.apikey, 'test-service-role-key');
    assert.equal(options.headers['Content-Type'], 'application/json');
    return response(200, [{
      id: 'job-001',
      type: 'REVENUE_PROSPECTING',
      status: 'pending',
      attempt_count: 0,
      worker_id: null,
      created_at: '2026-09-07T00:00:00Z',
      started_at: null,
      leased_until: null,
      completed_at: null,
      last_error: null,
      payload: {
        mission: 'find legitimate commercial buyers',
        offer_ids: ['OFFER-DREAMLEDGER-BILLBOARD-FOUNDING-001'],
        proof_truth: 'Supabase',
        payment_truth: 'Stripe',
        approval_gate: 'public outreach requires human approval',
        should_not_be_exposed: 'worker-instruction-payload'
      }
    }]);
  };

  try {
    const manifest = await invoke({ method: 'GET', url: '/api/agent-bridge/manifest', headers: {} });
    assert.equal(manifest.status, 200);
    assert.equal(manifest.json.endpoints.jobs.path, '/api/agent-bridge/jobs?status=pending&limit=10');

    const unauthorized = await invoke({ method: 'GET', url: '/api/agent-bridge/jobs', headers: {} });
    assert.equal(unauthorized.status, 401);

    const jobs = await invoke({
      method: 'GET',
      url: '/api/agent-bridge/jobs?status=pending&limit=5',
      headers: { 'x-dreamledger-agent-token': 'bridge-test-token' }
    });
    assert.equal(jobs.status, 200);
    assert.equal(jobs.json.schema_version, 'BECK-ECONOMIC-JOB-1.0');
    assert.equal(jobs.json.count, 1);

    const job = jobs.json.jobs[0];
    assert.equal(job.job_id, 'job-001');
    assert.equal(job.job_type, 'REVENUE_PROSPECTING');
    assert.equal(job.state, 'pending');
    assert.equal(job.objective, 'find legitimate commercial buyers');
    assert.deepEqual(job.offer_ids, ['OFFER-DREAMLEDGER-BILLBOARD-FOUNDING-001']);
    assert.equal(job.required_evidence.proof_truth, 'Supabase');
    assert.equal(job.required_evidence.payment_truth, 'Stripe');
    assert.equal(job.approval_required, true);
    assert.equal(job.next_permitted_action, 'PREPARE_ONLY_UNTIL_HUMAN_APPROVAL');
    assert.equal(Object.prototype.hasOwnProperty.call(job, 'payload'), false);
    assert.equal(calls.length, 1);

    console.log(JSON.stringify({
      schema: 'BEC-AGENT-BRIDGE-JOBS-VERIFY/v1',
      status: 'PASS',
      manifest: 'PASS',
      auth_gate: 'PASS',
      job_read: 'PASS',
      normalization: 'PASS',
      approval_boundary: 'PASS',
      raw_payload_not_exposed: 'PASS',
      checked_at: new Date().toISOString()
    }, null, 2));
  } finally {
    global.fetch = originalFetch;
  }
}

main().catch(err => {
  console.error(JSON.stringify({ schema: 'BEC-AGENT-BRIDGE-JOBS-VERIFY/v1', status: 'FAIL', error: err.message }, null, 2));
  process.exitCode = 1;
});
