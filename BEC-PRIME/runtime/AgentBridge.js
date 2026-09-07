'use strict';

/**
 * DreamLedger AgentBridge — upgraded structured multi-LLM economic control highway.
 * Canonical location: BEC-PRIME/runtime/AgentBridge.js
 *
 * Design rules (2026-09-08):
 * - Do NOT create a second bridge.
 * - Reuse existing control_bridge_notes for append-only structured events
 *   (zero schema change; live Supabase schema inspection currently blocked).
 * - Preserve human-approval gate and RA_000001 external-payment truth.
 * - All consequential external actions remain APPROVAL_REQUIRED.
 */

const ALLOWED_AGENTS = new Set([
  'chatgpt', 'claude', 'luna', 'deepseek', 'grok', 'monetizer',
  'humanizer', 'truth_oracle', 'gauntlet', 'system', 'human'
]);

const STRUCTURED_EVENT_TYPES = new Set([
  'CANDIDATE_FOUND',
  'EVIDENCE_ATTACHED',
  'DELIVERY_ASSESSMENT',
  'COMMERCIAL_ATTACK',
  'COURT_REVIEW',
  'COURT_VERDICT',
  'ACTION_PROPOSED',
  'ACTION_APPROVED',
  'ACTION_EXECUTED',
  'ACTION_FAILED',
  'PAYMENT_DETECTED',
  'FULFILLMENT_COMPLETED',
  'RECONCILIATION_COMPLETED'
]);

const NOTE_TYPES = new Set([
  'HANDOFF', 'QUESTION', 'FINDING', 'WARNING', 'DECISION', 'LOVE_NOTE',
  'STRUCTURED_EVENT' // carries the CORE EVENT ENVELOPE
]);

function config() {
  return {
    url: String(process.env.SUPABASE_URL || '').replace(/\/$/, ''),
    key: String(process.env.SUPABASE_SERVICE_ROLE_KEY || ''),
    token: String(process.env.DREAMLEDGER_AGENT_BRIDGE_TOKEN || '')
  };
}
function configured() { const c = config(); return Boolean(c.url && c.key && c.token); }
function authorized(req) { const c = config(); return configured() && String(req.headers['x-dreamledger-agent-token'] || '') === c.token; }

async function readJson(req) {
  let body = '';
  for await (const chunk of req) { body += chunk; if (body.length > 200000) throw new Error('Request too large'); }
  try { return JSON.parse(body || '{}'); } catch { throw new Error('Invalid JSON'); }
}

async function supabase(path, options = {}) {
  const c = config();
  if (!c.url || !c.key) throw new Error('Supabase bridge is not configured');
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
    const message = data && data.message ? data.message : `Supabase bridge request failed (${response.status})`;
    const error = new Error(message);
    error.statusCode = response.status;
    error.supabase = data;
    throw error;
  }
  return data;
}

function send(res, status, body) {
  if (res.writableEnded) return;
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function normalizedJob(job) {
  const payload = job && job.payload && typeof job.payload === 'object' ? job.payload : {};
  const approvalGate = payload.approval_gate == null ? null : String(payload.approval_gate);
  const approvalRequired = approvalGate ? /human|approval|required/i.test(approvalGate) : false;
  return {
    job_id: job.id, job_type: job.type, state: job.status, source: payload.source || 'jobs',
    objective: payload.mission || payload.objective || null, candidate_id: payload.candidate_id || null,
    offer_ids: Array.isArray(payload.offer_ids) ? payload.offer_ids : [], assigned_worker: job.worker_id || null,
    attempt_count: Number(job.attempt_count || 0),
    required_evidence: { proof_truth: payload.proof_truth || null, payment_truth: payload.payment_truth || null },
    existing_evidence: payload.existing_evidence || null,
    approval_required: approvalRequired, approval_gate: approvalGate,
    next_permitted_action: approvalRequired ? 'PREPARE_ONLY_UNTIL_HUMAN_APPROVAL' : 'WORKER_DEFINED',
    created_at: job.created_at, started_at: job.started_at || null, leased_until: job.leased_until || null,
    completed_at: job.completed_at || null, failure: job.last_error || null
  };
}

async function listJobs(url) {
  const requestedStatus = String(url.searchParams.get('status') || 'pending').trim();
  const allowedStatuses = new Set(['pending', 'leased', 'completed', 'failed', 'cancelled']);
  const status = allowedStatuses.has(requestedStatus) ? requestedStatus : 'pending';
  const requestedLimit = Number(url.searchParams.get('limit') || 10);
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(50, Math.floor(requestedLimit))) : 10;
  const path = `jobs?select=id,type,status,attempt_count,worker_id,created_at,started_at,leased_until,completed_at,last_error,payload&status=eq.${encodeURIComponent(status)}&order=created_at.asc&limit=${limit}`;
  const jobs = await supabase(path);
  return Array.isArray(jobs) ? jobs.map(normalizedJob) : [];
}

async function recordDoorwaySession(session) {
  if (!configured()) {
    console.warn('[AgentBridge] recordDoorwaySession: bridge_not_configured');
    return { recorded: false, reason: 'bridge_not_configured' };
  }
  const row = {
    event_type: 'DOORWAY_SESSION_STARTED',
    payload: {
      schema_version: 'BECK-DOORWAY-SESSION-1.0',
      session_id: String(session.session_id),
      doorway_id: String(session.doorway_id || 'QR-CANONICAL-001'),
      source: String(session.source || 'direct'),
      medium: String(session.medium || 'direct'),
      campaign: String(session.campaign || 'D-001'),
      placement: String(session.placement || 'unknown'),
      experiment_id: String(session.experiment_id || 'none'),
      offer_id: String(session.offer_id || ''),
      ip_hash: String(session.ip_hash || ''),
      user_agent: String(session.user_agent || '')
    }
  };
  try {
    const created = await supabase('telemetry_events', { method: 'POST', body: JSON.stringify(row) });
    console.log('[AgentBridge] recordDoorwaySession: success');
    return { recorded: true, event: Array.isArray(created) ? created[0] : created };
  } catch (err) {
    console.error('[AgentBridge] Supabase insert failed:', err.message);
    return { recorded: false, reason: err.message || 'Supabase insert failed' };
  }
}

// ─── Structured Event Layer (reuses control_bridge_notes) ───────────────────

function validateEventEnvelope(input) {
  const errors = [];
  const eventId = String(input.event_id || '').trim();
  const correlationId = String(input.correlation_id || '').trim();
  const eventType = String(input.event_type || '').trim().toUpperCase();
  const agent = String(input.agent || '').trim().toLowerCase();

  if (!eventId || eventId.length > 128) errors.push('event_id required (max 128)');
  if (!correlationId || correlationId.length > 128) errors.push('correlation_id required (max 128)');
  if (!STRUCTURED_EVENT_TYPES.has(eventType)) errors.push(`event_type must be one of ${Array.from(STRUCTURED_EVENT_TYPES).join(',')}`);
  if (!ALLOWED_AGENTS.has(agent)) errors.push('agent not allowed');

  if (['CANDIDATE_FOUND', 'EVIDENCE_ATTACHED'].includes(eventType) && !['grok', 'truth_oracle', 'system', 'human'].includes(agent)) {
    errors.push(`${eventType} may only be created by grok / truth_oracle / system / human`);
  }
  if (['DELIVERY_ASSESSMENT', 'COMMERCIAL_ATTACK'].includes(eventType) && !['claude', 'system', 'human'].includes(agent)) {
    errors.push(`${eventType} may only be created by claude / system / human`);
  }
  if (['COURT_REVIEW', 'COURT_VERDICT'].includes(eventType) && !['chatgpt', 'luna', 'system', 'human'].includes(agent)) {
    errors.push(`${eventType} may only be created by chatgpt / luna / system / human`);
  }
  if (eventType === 'ACTION_APPROVED' && agent !== 'human' && agent !== 'system') {
    errors.push('ACTION_APPROVED may only be created by human (or system fixture)');
  }

  if (errors.length) {
    const err = new Error(errors.join('; '));
    err.statusCode = 400;
    throw err;
  }

  return {
    event_id: eventId,
    correlation_id: correlationId,
    event_type: eventType,
    agent,
    created_at: input.created_at || new Date().toISOString(),
    subject_type: String(input.subject_type || 'economic_candidate').slice(0, 64),
    subject_id: String(input.subject_id || '').slice(0, 128),
    claim: String(input.claim || '').slice(0, 4000),
    evidence: Array.isArray(input.evidence) ? input.evidence.slice(0, 50) : [],
    confidence: Number.isFinite(Number(input.confidence)) ? Math.max(0, Math.min(1, Number(input.confidence))) : 0,
    requested_action: input.requested_action == null ? null : String(input.requested_action).slice(0, 256),
    status: String(input.status || 'OPEN').toUpperCase().slice(0, 32),
    parent_event_id: input.parent_event_id ? String(input.parent_event_id).slice(0, 128) : null
  };
}

async function ingestStructuredEvent(envelope) {
  // Idempotency check against existing STRUCTURED_EVENT notes
  const existing = await supabase(
    `control_bridge_notes?note_type=eq.STRUCTURED_EVENT&select=note_id,body,created_at&order=created_at.desc&limit=200`
  );
  if (Array.isArray(existing)) {
    for (const row of existing) {
      try {
        const parsed = JSON.parse(row.body || '{}');
        if (parsed && parsed.event_id === envelope.event_id) {
          return { event: parsed, note_id: row.note_id, idempotent: true };
        }
      } catch { /* ignore malformed */ }
    }
  }

  // Approval gate
  if (envelope.event_type === 'ACTION_EXECUTED') {
    const approved = await hasApprovedAction(envelope.correlation_id, envelope.subject_id || envelope.event_id);
    if (!approved) {
      const err = new Error('ACTION_EXECUTED rejected: no corresponding ACTION_APPROVED event for this correlation/subject');
      err.statusCode = 403;
      throw err;
    }
  }

  // PAYMENT_DETECTED is recorded only; never mutates ra000001_state
  const body = JSON.stringify(envelope);
  const row = {
    from_agent: envelope.agent,
    to_agent: 'system',
    note_type: 'STRUCTURED_EVENT',
    subject: `${envelope.event_type}:${envelope.correlation_id}`,
    body,
    requires_response: false
  };

  const created = await supabase('control_bridge_notes', {
    method: 'POST',
    body: JSON.stringify(row),
    prefer: 'return=representation'
  });
  const note = Array.isArray(created) ? created[0] : created;
  return { event: envelope, note_id: note && note.note_id, idempotent: false };
}

async function hasApprovedAction(correlationId, subjectId) {
  const notes = await supabase(
    `control_bridge_notes?note_type=eq.STRUCTURED_EVENT&select=body&order=created_at.asc&limit=500`
  );
  if (!Array.isArray(notes)) return false;
  for (const row of notes) {
    try {
      const ev = JSON.parse(row.body || '{}');
      if (ev.event_type === 'ACTION_APPROVED' &&
          ev.correlation_id === correlationId &&
          (ev.subject_id === subjectId || !subjectId)) {
        return true;
      }
    } catch { /* ignore */ }
  }
  return false;
}

async function getEventById(eventId) {
  const notes = await supabase(
    `control_bridge_notes?note_type=eq.STRUCTURED_EVENT&select=note_id,body,created_at&order=created_at.desc&limit=300`
  );
  if (!Array.isArray(notes)) return null;
  for (const row of notes) {
    try {
      const ev = JSON.parse(row.body || '{}');
      if (ev.event_id === eventId) return { ...ev, _note_id: row.note_id, _stored_at: row.created_at };
    } catch { /* ignore */ }
  }
  return null;
}

async function getCorrelationChain(correlationId) {
  const notes = await supabase(
    `control_bridge_notes?note_type=eq.STRUCTURED_EVENT&select=note_id,body,created_at&order=created_at.asc&limit=500`
  );
  const chain = [];
  if (!Array.isArray(notes)) return chain;
  for (const row of notes) {
    try {
      const ev = JSON.parse(row.body || '{}');
      if (ev.correlation_id === correlationId) {
        chain.push({ ...ev, _note_id: row.note_id, _stored_at: row.created_at });
      }
    } catch { /* ignore */ }
  }
  return chain;
}

// ─── Main request handler ───────────────────────────────────────────────────

async function handle(req, res) {
  const rawUrl = String(req.url || '');
  const url = rawUrl.split('?')[0];
  if (!url.startsWith('/api/agent-bridge')) return false;

  if (req.method === 'GET' && url === '/api/agent-bridge/manifest') {
    return send(res, 200, {
      schema_version: 'BECK-AGENT-BRIDGE-1.1',
      service: 'DreamLedger',
      canonical_doorway: 'https://dreamledger.org/go',
      purpose: 'Shared control-plane bridge for agent handoffs, structured economic events, and state inspection',
      authentication: 'x-dreamledger-agent-token',
      endpoints: {
        state: { method: 'GET', path: '/api/agent-bridge/state', auth: true },
        jobs: { method: 'GET', path: '/api/agent-bridge/jobs?status=pending&limit=10', auth: true },
        next_job: { method: 'GET', path: '/api/agent-bridge/jobs/next', auth: true, mutation: false },
        notes: { method: 'GET', path: '/api/agent-bridge/notes', auth: true },
        create_note: { method: 'POST', path: '/api/agent-bridge/notes', auth: true },
        events: { method: 'POST', path: '/api/agent-bridge/events', auth: true },
        event_by_id: { method: 'GET', path: '/api/agent-bridge/events/:id', auth: true },
        correlation: { method: 'GET', path: '/api/agent-bridge/correlations/:id', auth: true },
        approve_action: { method: 'POST', path: '/api/agent-bridge/actions/:id/approve', auth: true }
      },
      agents: Array.from(ALLOWED_AGENTS),
      event_types: Array.from(STRUCTURED_EVENT_TYPES),
      external_actions: 'human_approval_required',
      payment_truth: 'RA_000001 requires independently verified external payment',
      structured_event_storage: 'control_bridge_notes (note_type=STRUCTURED_EVENT)'
    });
  }

  if (!configured()) return send(res, 503, { error: 'Agent bridge is not configured' });
  if (!authorized(req)) return send(res, 401, { error: 'Agent bridge authentication required' });

  try {
    if (req.method === 'GET' && url === '/api/agent-bridge/state') {
      const [state, dashboard, evidence, notes, doorwaySessions] = await Promise.all([
        supabase('ra000001_state?select=*'),
        supabase('control_dashboard?select=*'),
        supabase('control_evidence_current?select=*&order=created_at.desc&limit=50'),
        supabase('control_bridge_notes?select=note_id,from_agent,to_agent,note_type,subject,body,requires_response,response_note_id,created_at&order=created_at.desc&limit=50'),
        supabase('telemetry_events?event_type=eq.DOORWAY_SESSION_STARTED&select=id,event_type,offer_id,payload,event_timestamp&order=event_timestamp.desc&limit=25')
      ]);
      return send(res, 200, {
        state: state[0] || null,
        dashboard: dashboard[0] || null,
        evidence,
        notes,
        doorway_sessions: doorwaySessions
      });
    }

    if (req.method === 'GET' && url === '/api/agent-bridge/jobs/next') {
      const jobs = await listJobs(new URL('http://agent-bridge.local/api/agent-bridge/jobs?status=pending&limit=1'));
      return send(res, 200, { schema_version: 'BECK-ECONOMIC-JOB-1.0', job: jobs[0] || null, count: jobs.length, mutation: 'none' });
    }

    if (req.method === 'GET' && url === '/api/agent-bridge/jobs') {
      const jobs = await listJobs(new URL(`http://agent-bridge.local${rawUrl}`));
      return send(res, 200, { schema_version: 'BECK-ECONOMIC-JOB-1.0', count: jobs.length, jobs });
    }

    if (req.method === 'GET' && url === '/api/agent-bridge/notes') {
      const notes = await supabase('control_bridge_notes?select=*&order=created_at.desc&limit=100');
      return send(res, 200, { notes });
    }

    if (req.method === 'POST' && url === '/api/agent-bridge/notes') {
      const input = await readJson(req);
      const fromAgent = String(input.from_agent || '').trim();
      const toAgent = String(input.to_agent || '').trim();
      const noteType = String(input.note_type || 'HANDOFF').trim().toUpperCase();
      const subject = String(input.subject || '').trim();
      const body = String(input.body || '').trim();

      if (!ALLOWED_AGENTS.has(fromAgent)) return send(res, 400, { error: 'Unsupported from_agent' });
      if (!toAgent || !ALLOWED_AGENTS.has(toAgent)) return send(res, 400, { error: 'Unsupported to_agent' });
      if (!NOTE_TYPES.has(noteType)) return send(res, 400, { error: 'Unsupported note_type' });
      if (!subject || subject.length > 500) return send(res, 400, { error: 'subject is required and must be <= 500 characters' });
      if (!body || body.length > 50000) return send(res, 400, { error: 'body is required and must be <= 50000 characters' });
      if (input.note_id && !/^[0-9a-f-]{36}$/i.test(String(input.note_id))) return send(res, 400, { error: 'Invalid note_id' });

      const row = {
        ...(input.note_id ? { note_id: String(input.note_id) } : {}),
        from_agent: fromAgent,
        to_agent: toAgent,
        note_type: noteType,
        subject,
        body,
        requires_response: Boolean(input.requires_response)
      };
      const created = await supabase('control_bridge_notes', { method: 'POST', body: JSON.stringify(row) });
      return send(res, 201, { note: Array.isArray(created) ? created[0] : created });
    }

    // Structured event routes
    if (req.method === 'POST' && url === '/api/agent-bridge/events') {
      const input = await readJson(req);
      const envelope = validateEventEnvelope(input);
      const result = await ingestStructuredEvent(envelope);
      return send(res, result.idempotent ? 200 : 201, {
        schema_version: 'BECK-STRUCTURED-EVENT-1.0',
        idempotent: result.idempotent,
        event: result.event,
        note_id: result.note_id
      });
    }

    const eventMatch = url.match(/^\/api\/agent-bridge\/events\/([^/]+)$/);
    if (req.method === 'GET' && eventMatch) {
      const eventId = decodeURIComponent(eventMatch[1]);
      const event = await getEventById(eventId);
      if (!event) return send(res, 404, { error: 'Event not found' });
      return send(res, 200, { schema_version: 'BECK-STRUCTURED-EVENT-1.0', event });
    }

    const corrMatch = url.match(/^\/api\/agent-bridge\/correlations\/([^/]+)$/);
    if (req.method === 'GET' && corrMatch) {
      const correlationId = decodeURIComponent(corrMatch[1]);
      const chain = await getCorrelationChain(correlationId);
      return send(res, 200, {
        schema_version: 'BECK-STRUCTURED-EVENT-1.0',
        correlation_id: correlationId,
        count: chain.length,
        events: chain
      });
    }

    const approveMatch = url.match(/^\/api\/agent-bridge\/actions\/([^/]+)\/approve$/);
    if (req.method === 'POST' && approveMatch) {
      const actionId = decodeURIComponent(approveMatch[1]);
      const input = await readJson(req);
      const correlationId = String(input.correlation_id || '').trim();
      if (!correlationId) return send(res, 400, { error: 'correlation_id required' });

      const agent = String(input.agent || 'human').trim().toLowerCase();
      if (agent !== 'human' && agent !== 'system') {
        return send(res, 403, { error: 'Only human may approve consequential actions' });
      }

      const envelope = validateEventEnvelope({
        event_id: `EVT_APPROVE_${actionId}_${Date.now()}`,
        correlation_id: correlationId,
        event_type: 'ACTION_APPROVED',
        agent,
        subject_type: 'action',
        subject_id: actionId,
        claim: input.claim || `Human approval for action ${actionId}`,
        evidence: input.evidence || [],
        confidence: 1.0,
        requested_action: actionId,
        status: 'APPROVED',
        parent_event_id: input.parent_event_id || null
      });

      const result = await ingestStructuredEvent(envelope);
      return send(res, 201, {
        schema_version: 'BECK-STRUCTURED-EVENT-1.0',
        approved: true,
        event: result.event,
        note_id: result.note_id
      });
    }

    return send(res, 404, { error: 'Agent bridge route not found' });
  } catch (err) {
    return send(res, err.statusCode || 500, { error: err.message || 'Agent bridge failure' });
  }
}

module.exports = {
  handle,
  configured,
  recordDoorwaySession,
  normalizedJob,
  listJobs,
  validateEventEnvelope,
  STRUCTURED_EVENT_TYPES,
  ALLOWED_AGENTS
};
