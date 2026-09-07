'use strict';

/**
 * Live proof for the authenticated AgentBridge structured-event path.
 *
 * Required environment:
 *   DREAMLEDGER_AGENT_BRIDGE_URL  e.g. https://<internal-service>/api/agent-bridge
 *   DREAMLEDGER_AGENT_BRIDGE_TOKEN
 *
 * This intentionally uses TEST-CORRELATION and never treats PAYMENT_DETECTED
 * as economic truth. It proves transport, durable correlation retrieval,
 * idempotency, the ACTION_EXECUTED approval firewall, and RA_000001 isolation.
 */

const assert = require('assert/strict');

const BASE = String(process.env.DREAMLEDGER_AGENT_BRIDGE_URL || '').replace(/\/$/, '');
const TOKEN = String(process.env.DREAMLEDGER_AGENT_BRIDGE_TOKEN || '');
const CORRELATION_ID = `TEST-CORRELATION-${Date.now()}`;
const SUBJECT_ID = `TEST-CANDIDATE-${Date.now()}`;
const ACTION_ID = `TEST-ACTION-${Date.now()}`;

if (!BASE || !TOKEN) {
  throw new Error('DREAMLEDGER_AGENT_BRIDGE_URL and DREAMLEDGER_AGENT_BRIDGE_TOKEN are required');
}

async function call(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-dreamledger-agent-token': TOKEN,
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: response.status, json, text };
}

function event(eventId, eventType, agent, extra = {}) {
  return {
    event_id: eventId,
    correlation_id: CORRELATION_ID,
    event_type: eventType,
    agent,
    subject_type: extra.subject_type || 'economic_candidate',
    subject_id: extra.subject_id || SUBJECT_ID,
    claim: extra.claim || 'TEST ONLY: bridge verification event',
    evidence: [{ tier: 'E0', source: 'TEST-ONLY', independent: false }],
    confidence: 0,
    requested_action: extra.requested_action || null,
    status: extra.status || 'OPEN'
  };
}

async function main() {
  const manifest = await call('/manifest', { headers: {} });
  assert.equal(manifest.status, 200, `manifest failed: ${manifest.text}`);
  assert.equal(manifest.json?.schema_version, 'BECK-AGENT-BRIDGE-1.1');
  assert.equal(manifest.json?.external_actions, 'human_approval_required');
  assert.equal(manifest.json?.payment_truth, 'RA_000001 requires independently verified external payment');

  const before = await call('/state');
  assert.equal(before.status, 200, `state failed: ${before.text}`);
  assert.equal(before.json?.state?.status, 'OPEN');
  assert.equal(Number(before.json?.state?.verified_payment_count || 0), 0);
  assert.equal(Number(before.json?.state?.revenue_nzd || 0), 0);

  const candidateEventId = `EVT_TEST_CANDIDATE_${Date.now()}`;
  const candidate = await call('/events', {
    method: 'POST',
    body: JSON.stringify(event(candidateEventId, 'CANDIDATE_FOUND', 'grok', {
      claim: 'TEST ONLY: CANDIDATE_FOUND transport proof'
    }))
  });
  assert.equal(candidate.status, 201, `candidate event failed: ${candidate.text}`);
  assert.equal(candidate.json?.event?.correlation_id, CORRELATION_ID);
  assert.equal(candidate.json?.idempotent, false);

  const chain = await call(`/correlations/${encodeURIComponent(CORRELATION_ID)}`);
  assert.equal(chain.status, 200, `correlation retrieval failed: ${chain.text}`);
  assert.equal(chain.json?.correlation_id, CORRELATION_ID);
  assert.ok(Array.isArray(chain.json?.events));
  assert.ok(chain.json.events.some(ev => ev.event_id === candidateEventId));

  const replay = await call('/events', {
    method: 'POST',
    body: JSON.stringify(event(candidateEventId, 'CANDIDATE_FOUND', 'grok', {
      claim: 'TEST ONLY: replay of the same event id'
    }))
  });
  assert.equal(replay.status, 200, `idempotent replay failed: ${replay.text}`);
  assert.equal(replay.json?.idempotent, true);

  const unapproved = await call('/events', {
    method: 'POST',
    body: JSON.stringify(event(`EVT_TEST_EXEC_${Date.now()}`, 'ACTION_EXECUTED', 'grok', {
      subject_type: 'action',
      subject_id: ACTION_ID,
      requested_action: ACTION_ID,
      claim: 'TEST ONLY: must be rejected without approval'
    }))
  });
  assert.equal(unapproved.status, 403, `unapproved ACTION_EXECUTED was not blocked: ${unapproved.text}`);

  const approved = await call(`/actions/${encodeURIComponent(ACTION_ID)}/approve`, {
    method: 'POST',
    body: JSON.stringify({
      correlation_id: CORRELATION_ID,
      agent: 'human',
      claim: 'TEST ONLY: synthetic human approval fixture; no external action authorized',
      evidence: [{ tier: 'E0', source: 'TEST-ONLY', independent: false }]
    })
  });
  assert.equal(approved.status, 201, `test approval fixture failed: ${approved.text}`);

  const executed = await call('/events', {
    method: 'POST',
    body: JSON.stringify(event(`EVT_TEST_EXEC_APPROVED_${Date.now()}`, 'ACTION_EXECUTED', 'grok', {
      subject_type: 'action',
      subject_id: ACTION_ID,
      requested_action: ACTION_ID,
      claim: 'TEST ONLY: approved execution event; no external side effect'
    }))
  });
  assert.equal(executed.status, 201, `approved ACTION_EXECUTED failed: ${executed.text}`);

  const fakePayment = await call('/events', {
    method: 'POST',
    body: JSON.stringify(event(`EVT_TEST_PAYMENT_${Date.now()}`, 'PAYMENT_DETECTED', 'grok', {
      subject_type: 'payment',
      subject_id: 'TEST-PAYMENT-NOT-REAL',
      claim: 'TEST ONLY: fake PAYMENT_DETECTED must never become RA_000001 truth'
    }))
  });
  assert.equal(fakePayment.status, 201, `fake payment event was not accepted as a test event: ${fakePayment.text}`);

  const after = await call('/state');
  assert.equal(after.status, 200, `post-test state failed: ${after.text}`);
  assert.equal(after.json?.state?.status, 'OPEN');
  assert.equal(Number(after.json?.state?.verified_payment_count || 0), 0);
  assert.equal(Number(after.json?.state?.revenue_nzd || 0), 0);
  assert.equal(after.json?.state?.independently_verified, false);

  console.log(JSON.stringify({
    schema: 'BEC-AGENT-BRIDGE-STRUCTURED-EVENTS-LIVE-VERIFY/v1',
    status: 'PASS',
    correlation: 'PASS',
    durable_retrieval: 'PASS',
    idempotency: 'PASS',
    unapproved_action_rejected: 'PASS',
    approved_test_action_path: 'PASS',
    fake_payment_isolated: 'PASS',
    ra000001_untouched: 'PASS',
    correlation_id: CORRELATION_ID,
    test_subject_id: SUBJECT_ID,
    test_action_id: ACTION_ID,
    checked_at: new Date().toISOString()
  }, null, 2));
}

main().catch(err => {
  console.error(JSON.stringify({
    schema: 'BEC-AGENT-BRIDGE-STRUCTURED-EVENTS-LIVE-VERIFY/v1',
    status: 'FAIL',
    error: err.message
  }, null, 2));
  process.exitCode = 1;
});
