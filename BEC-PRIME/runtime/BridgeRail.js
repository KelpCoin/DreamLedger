'use strict';

const crypto = require('crypto');

const RAIL_SCHEMA = 'BECK-BRIDGE-RAIL-1.0';
const LEASE_TTL_SECONDS = 900;

function config() {
  return {
    url: String(process.env.SUPABASE_URL || '').replace(/\/$/, ''),
    key: String(process.env.SUPABASE_SERVICE_ROLE_KEY || ''),
    token: String(process.env.DREAMLEDGER_AGENT_BRIDGE_TOKEN || ''),
    signingSecret: String(process.env.BECK_BRIDGE_SIGNING_SECRET || '')
  };
}

function configured() {
  const c = config();
  return Boolean(c.url && c.key && c.token && c.signingSecret);
}

function authorized(req) {
  const c = config();
  return configured() && String(req.headers['x-dreamledger-agent-token'] || '') === c.token;
}

async function readJson(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 200000) throw new Error('Request too large');
  }
  return JSON.parse(body || '{}');
}

async function supabase(path, options = {}) {
  const c = config();
  const response = await fetch(`${c.url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: c.key,
      Authorization: `Bearer ${c.key}`,
      'Content-Type': 'application/json',
      Prefer: options.prefer || 'return=representation',
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text || 'null'); } catch { data = { raw: text }; }
  if (!response.ok) {
    const error = new Error(data && data.message ? data.message : `Supabase rail request failed (${response.status})`);
    error.statusCode = response.status;
    throw error;
  }
  return data;
}

function canonicalEnvelope(envelope) {
  return JSON.stringify({
    schema_version: envelope.schema_version,
    lease_id: envelope.lease_id,
    job_id: envelope.job_id,
    worker_id: envelope.worker_id,
    issued_at: envelope.issued_at,
    expires_at: envelope.expires_at,
    objective: envelope.objective,
    silo_id: envelope.silo_id
  });
}

function sign(envelope) {
  return crypto.createHmac('sha256', config().signingSecret).update(canonicalEnvelope(envelope)).digest('hex');
}

function verify(envelope, signature) {
  const expected = sign(envelope);
  const a = Buffer.from(String(signature || ''), 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function send(res, status, body) {
  if (res.writableEnded) return;
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(body));
}

async function durableNote(fromAgent, toAgent, subject, payload, correlationId, lane = 'execution') {
  const row = {
    from_agent: fromAgent,
    to_agent: toAgent,
    note_type: 'HANDOFF',
    subject,
    body: JSON.stringify(payload),
    requires_response: false,
    correlation_id: correlationId,
    lane,
    priority: 90,
    silo_id: payload.silo_id || 'SILO_GENERAL',
    source_system: 'beck-bridge-rail'
  };
  const created = await supabase('control_bridge_notes', { method: 'POST', body: JSON.stringify(row) });
  return Array.isArray(created) ? created[0] : created;
}

async function leaseJob(workerId) {
  const jobs = await supabase('jobs?select=id,type,status,attempt_count,payload,created_at&status=eq.pending&order=created_at.asc&limit=1');
  if (!Array.isArray(jobs) || !jobs.length) return null;
  const job = jobs[0];
  const now = new Date();
  const expires = new Date(now.getTime() + LEASE_TTL_SECONDS * 1000);
  const leaseId = `LEASE_${crypto.randomUUID()}`;
  const payload = job.payload && typeof job.payload === 'object' ? job.payload : {};
  const envelope = {
    schema_version: RAIL_SCHEMA,
    lease_id: leaseId,
    job_id: job.id,
    worker_id: String(workerId),
    issued_at: now.toISOString(),
    expires_at: expires.toISOString(),
    objective: String(payload.mission || payload.objective || job.type || 'worker task'),
    silo_id: String(payload.silo_id || 'SILO_GENERAL')
  };
  const signature = sign(envelope);
  const updated = await supabase(`jobs?id=eq.${encodeURIComponent(job.id)}&status=eq.pending`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: 'leased',
      worker_id: String(workerId),
      started_at: now.toISOString(),
      leased_until: expires.toISOString(),
      attempt_count: Number(job.attempt_count || 0) + 1
    })
  });
  if (!Array.isArray(updated) || !updated.length) return null;
  await durableNote('system', String(workerId), `BRIDGE_LEASE:${leaseId}`, {
    rail_schema: RAIL_SCHEMA,
    stage: 'LEASE_ISSUED',
    ...envelope,
    signature
  }, leaseId);
  return { envelope, signature, job: updated[0] };
}

async function recordStage(input) {
  const envelope = input && input.envelope;
  const signature = String(input && input.signature || '');
  const workerId = String(input && input.worker_id || '').trim();
  const stage = String(input && input.stage || '').trim().toUpperCase();
  if (!envelope || !verify(envelope, signature)) {
    const err = new Error('Invalid bridge lease signature');
    err.statusCode = 403;
    throw err;
  }
  if (String(envelope.worker_id) !== workerId) {
    const err = new Error('Worker identity does not match signed lease');
    err.statusCode = 403;
    throw err;
  }
  if (Date.parse(envelope.expires_at) < Date.now()) {
    const err = new Error('Bridge lease expired');
    err.statusCode = 409;
    throw err;
  }
  if (!['WORKER_A_RESULT', 'WORKER_B_RESULT'].includes(stage)) {
    const err = new Error('stage must be WORKER_A_RESULT or WORKER_B_RESULT');
    err.statusCode = 400;
    throw err;
  }

  const resultHash = crypto.createHash('sha256').update(JSON.stringify(input.result || {})).digest('hex');
  const payload = {
    rail_schema: RAIL_SCHEMA,
    stage,
    lease_id: envelope.lease_id,
    job_id: envelope.job_id,
    worker_id: workerId,
    parent_signature: signature,
    result_hash: resultHash,
    result: input.result || {},
    recorded_at: new Date().toISOString()
  };
  const note = await durableNote(workerId, stage === 'WORKER_A_RESULT' ? 'system' : 'truth_oracle', `BRIDGE_STAGE:${envelope.lease_id}:${stage}`, payload, envelope.lease_id);

  if (stage === 'WORKER_B_RESULT') {
    await supabase(`jobs?id=eq.${encodeURIComponent(envelope.job_id)}&status=eq.leased`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'completed', completed_at: new Date().toISOString(), last_error: null })
    });
    await durableNote('system', 'truth_oracle', `BRIDGE_PROOF:${envelope.lease_id}`, {
      rail_schema: RAIL_SCHEMA,
      status: 'BRIDGE_PROVEN_CANDIDATE',
      lease_id: envelope.lease_id,
      job_id: envelope.job_id,
      worker_a_and_b_observed: true,
      worker_b_result_hash: resultHash,
      sealed_at: new Date().toISOString()
    }, envelope.lease_id, 'reconciliation');
  }

  return { rail_schema: RAIL_SCHEMA, accepted: true, stage, lease_id: envelope.lease_id, job_id: envelope.job_id, result_hash: resultHash, note_id: note && note.note_id };
}

async function handle(req, res) {
  const path = String(req.url || '').split('?')[0];
  if (!path.startsWith('/api/agent-bridge/rail')) return false;
  if (!configured()) return send(res, 503, { error: 'Bridge rail is not configured' });
  if (!authorized(req)) return send(res, 401, { error: 'Bridge rail authentication required' });

  try {
    if (req.method === 'GET' && path === '/api/agent-bridge/rail/manifest') {
      return send(res, 200, {
        schema_version: RAIL_SCHEMA,
        status: 'ARMED',
        authentication: 'x-dreamledger-agent-token',
        runtime_authority: 'signed HMAC lease envelope',
        durable_store: 'Supabase jobs + control_bridge_notes',
        lease_ttl_seconds: LEASE_TTL_SECONDS,
        stages: ['LEASE_ISSUED', 'WORKER_A_RESULT', 'WORKER_B_RESULT', 'BRIDGE_PROVEN_CANDIDATE'],
        irreversible_effects: false
      });
    }
    if (req.method === 'POST' && path === '/api/agent-bridge/rail/lease') {
      const input = await readJson(req);
      const workerId = String(input.worker_id || '').trim().toLowerCase();
      if (!workerId || !/^[a-z0-9_-]{2,64}$/.test(workerId)) return send(res, 400, { error: 'Valid worker_id required' });
      const lease = await leaseJob(workerId);
      if (!lease) return send(res, 204, null);
      return send(res, 201, lease);
    }
    if (req.method === 'POST' && path === '/api/agent-bridge/rail/stage') {
      const input = await readJson(req);
      const result = await recordStage(input);
      return send(res, 201, result);
    }
    return send(res, 404, { error: 'Bridge rail route not found' });
  } catch (err) {
    return send(res, err.statusCode || 500, { error: err.message || 'Bridge rail failure' });
  }
}

module.exports = { handle, configured, sign, verify, RAIL_SCHEMA };
