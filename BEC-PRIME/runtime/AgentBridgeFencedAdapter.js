'use strict';

const legacy = require('./AgentBridgeProxyAdapter');
const crypto = require('crypto');

function config() {
  const url = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const token = String(process.env.DREAMLEDGER_AGENT_BRIDGE_TOKEN || '');
  const proxy = String(process.env.AGENT_BRIDGE_PROXY_URL || `${url}/functions/v1/agent-bridge-proxy`).replace(/\/$/, '');
  return { url, token, proxy };
}
function configured() { const c = config(); return Boolean(c.url && c.token && c.proxy); }
function authorized(req) { const c = config(); return configured() && String(req.headers['x-dreamledger-agent-token'] || '') === c.token; }
function correlationId(req) { return String(req.headers['x-correlation-id'] || '').trim() || crypto.randomUUID(); }
function send(res, status, body, correlation) {
  if (res.writableEnded) return;
  if (correlation) res.setHeader('X-Correlation-ID', correlation);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}
async function readJson(req) {
  let raw = '';
  for await (const chunk of req) { raw += chunk; if (raw.length > 200000) throw Object.assign(new Error('Request too large'), { statusCode: 413 }); }
  try { return JSON.parse(raw || '{}'); } catch (_) { throw Object.assign(new Error('Invalid JSON'), { statusCode: 400 }); }
}
async function db(path, method, body) {
  const c = config();
  const response = await fetch(c.proxy, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-dreamledger-agent-token': c.token }, body: JSON.stringify({ path, method: method || 'GET', prefer: 'return=representation', body: method === 'GET' ? undefined : (body || {}) }) });
  const text = await response.text();
  let data; try { data = JSON.parse(text || 'null'); } catch (_) { data = { raw: text }; }
  if (!response.ok) throw Object.assign(new Error(data && data.error ? data.error : `Bridge proxy failed (${response.status})`), { statusCode: response.status });
  return data;
}
function jobView(job, correlation) {
  if (!job) return null;
  return { job_id: job.id, job_type: job.type, state: job.status, payload: job.payload || {}, worker_id: job.worker_id || null, attempt_count: Number(job.attempt_count || 0), started_at: job.started_at || null, leased_until: job.leased_until || null, correlation_id: correlation };
}
async function findReceipt(eventId) {
  const existing = await db(`control_bridge_notes?note_type=eq.STRUCTURED_EVENT&event_id=eq.${encodeURIComponent(eventId)}&select=note_id,body&limit=1`, 'GET');
  if (!Array.isArray(existing) || !existing.length) return null;
  try { return { note_id: existing[0].note_id, receipt: JSON.parse(existing[0].body || '{}') }; } catch (_) { return null; }
}
async function remember(eventId, body) {
  const existing = await findReceipt(eventId);
  if (existing) return { idempotent: true, receipt: existing.receipt, note_id: existing.note_id };
  const row = { from_agent: 'system', to_agent: 'system', note_type: 'STRUCTURED_EVENT', subject: `HTTP_BRIDGE_OPERATION:${eventId}`, body: JSON.stringify(body), requires_response: false, event_id: eventId, correlation_id: body.correlation_id, lane: 'execution', priority: 100, silo_id: 'SILO_GENERAL', source_system: 'agentbridge-http' };
  try {
    const created = await db('control_bridge_notes', 'POST', row);
    const note = Array.isArray(created) ? created[0] : created;
    return { idempotent: false, receipt: body, note_id: note && note.note_id };
  } catch (e) {
    if (Number(e.statusCode) !== 409) throw e;
    const raced = await findReceipt(eventId);
    if (raced) return { idempotent: true, receipt: raced.receipt, note_id: raced.note_id };
    throw e;
  }
}
async function waitForReceipt(eventId, attempts) {
  for (let i = 0; i < attempts; i += 1) {
    const found = await findReceipt(eventId);
    if (found && found.receipt && found.receipt.status === 'SUCCEEDED') return found;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return null;
}

async function handle(req, res) {
  const path = String(req.url || '').split('?')[0];
  const nextClaim = path === '/api/agent-bridge/jobs/claim';
  const match = path.match(/^\/api\/agent-bridge\/jobs\/([^/]+)\/(complete|fail|heartbeat)$/);
  if (!nextClaim && !match) return legacy.handle(req, res);
  const correlation = correlationId(req);
  if (!configured()) return send(res, 503, { error: 'Agent bridge is not configured', correlation_id: correlation }, correlation);
  if (!authorized(req)) return send(res, 401, { error: 'Agent bridge authentication required', correlation_id: correlation }, correlation);
  if (req.method !== 'POST') return send(res, 405, { error: 'POST required', correlation_id: correlation }, correlation);
  try {
    const input = await readJson(req);
    const workerId = String(input.worker_id || '').trim();
    if (!workerId) return send(res, 400, { error: 'worker_id required', correlation_id: correlation }, correlation);
    if (nextClaim) {
      const leaseSeconds = Math.max(30, Math.min(3600, Number(input.lease_seconds || 900)));
      const claimed = await db('rpc/claim_job', 'POST', { p_worker_id: workerId, p_lease_seconds: leaseSeconds });
      if (!claimed) return send(res, 200, { claimed: false, reason: 'NO_JOB', correlation_id: correlation }, correlation);
      return send(res, 200, { claimed: true, job: jobView(claimed, correlation), lease_token: claimed.lease_token, lease_until: claimed.leased_until, correlation_id: correlation }, correlation);
    }
    const jobId = decodeURIComponent(match[1]);
    const op = match[2];
    const token = String(input.lease_token || '').trim();
    if (!token) return send(res, 400, { error: 'lease_token required', correlation_id: correlation }, correlation);
    if (op === 'heartbeat') {
      const seconds = Math.max(30, Math.min(3600, Number(input.lease_seconds || 900)));
      const ok = await db('rpc/renew_job', 'POST', { p_job_id: jobId, p_lease_token: token, p_lease_seconds: seconds });
      if (!ok) return send(res, 409, { renewed: false, reason: 'LEASE_LOST', correlation_id: correlation, fenced: true }, correlation);
      return send(res, 200, { renewed: true, lease_seconds: seconds, correlation_id: correlation }, correlation);
    }
    const eventId = `HTTP-${op.toUpperCase()}-${jobId}-${token}`;
    const replay = await remember(eventId, { operation: op, job_id: jobId, lease_token: token, worker_id: workerId, correlation_id: correlation, status: 'PROCESSING' });
    if (replay.idempotent) {
      if (replay.receipt && replay.receipt.status === 'SUCCEEDED') return send(res, 200, Object.assign({}, replay.receipt, { idempotent: true }), correlation);
      const finished = await waitForReceipt(eventId, 20);
      if (finished && finished.receipt) return send(res, 200, Object.assign({}, finished.receipt, { idempotent: true }), correlation);
      return send(res, 409, { operation: op, job_id: jobId, reason: 'SETTLEMENT_IN_PROGRESS', correlation_id: correlation, idempotent: true }, correlation);
    }
    const ok = op === 'complete'
      ? await db('rpc/complete_job', 'POST', { p_job_id: jobId, p_lease_token: token })
      : await db('rpc/fail_job', 'POST', { p_job_id: jobId, p_lease_token: token, p_error: String(input.error || 'worker failure').slice(0, 4000) });
    if (!ok) return send(res, 409, { [op === 'complete' ? 'completed' : 'failed']: false, reason: 'LEASE_NOT_HELD', correlation_id: correlation, fenced: true }, correlation);
    const receipt = { operation: op, job_id: jobId, lease_token: token, worker_id: workerId, correlation_id: correlation, status: 'SUCCEEDED', [op === 'complete' ? 'completed' : 'failed']: true, idempotent: false };
    await db(`control_bridge_notes?note_type=eq.STRUCTURED_EVENT&event_id=eq.${encodeURIComponent(eventId)}`, 'PATCH', { body: JSON.stringify(receipt), execution_status: 'SUCCEEDED', completed_at: new Date().toISOString() });
    return send(res, 200, receipt, correlation);
  } catch (e) {
    return send(res, e.statusCode || 500, { error: e.message || 'AgentBridge operation failed', correlation_id: correlation }, correlation);
  }
}

module.exports = Object.assign({}, legacy, { handle });
