'use strict';

const ALLOWED_AGENTS = new Set([
  'chatgpt', 'claude', 'luna', 'deepseek', 'grok', 'monetizer',
  'humanizer', 'truth_oracle', 'gauntlet', 'system', 'human'
]);

function config() {
  return {
    url: String(process.env.SUPABASE_URL || '').replace(/\/$/, ''),
    key: String(process.env.SUPABASE_SERVICE_ROLE_KEY || ''),
    token: String(process.env.DREAMLEDGER_AGENT_BRIDGE_TOKEN || '')
  };
}

function configured() {
  const c = config();
  return Boolean(c.url && c.key && c.token);
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
      Prefer: 'return=representation',
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
    throw error;
  }
  return data;
}

function send(res, status, body) {
  if (res.writableEnded) return;
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(body));
}

async function handle(req, res) {
  const url = String(req.url || '').split('?')[0];
  if (!url.startsWith('/api/agent-bridge')) return false;

  if (req.method === 'GET' && url === '/api/agent-bridge/manifest') {
    return send(res, 200, {
      schema_version: 'BECK-AGENT-BRIDGE-1.0',
      service: 'DreamLedger',
      canonical_doorway: 'https://dreamledger.org/go',
      purpose: 'Shared control-plane bridge for agent handoffs and economic state inspection',
      authentication: 'x-dreamledger-agent-token',
      endpoints: {
        state: { method: 'GET', path: '/api/agent-bridge/state', auth: true },
        notes: { method: 'GET', path: '/api/agent-bridge/notes', auth: true },
        create_note: { method: 'POST', path: '/api/agent-bridge/notes', auth: true }
      },
      agents: Array.from(ALLOWED_AGENTS),
      external_actions: 'human_approval_required',
      payment_truth: 'RA_000001 requires independently verified external payment'
    });
  }

  if (!configured()) return send(res, 503, { error: 'Agent bridge is not configured' });
  if (!authorized(req)) return send(res, 401, { error: 'Agent bridge authentication required' });

  try {
    if (req.method === 'GET' && url === '/api/agent-bridge/state') {
      const [state, dashboard, evidence, notes] = await Promise.all([
        supabase('ra000001_state?select=*'),
        supabase('control_dashboard?select=*'),
        supabase('control_evidence_current?select=*&order=created_at.desc&limit=50'),
        supabase('control_bridge_notes?select=note_id,from_agent,to_agent,note_type,subject,body,requires_response,response_note_id,created_at&order=created_at.desc&limit=50')
      ]);
      return send(res, 200, { state: state[0] || null, dashboard: dashboard[0] || null, evidence, notes });
    }

    if (req.method === 'GET' && url === '/api/agent-bridge/notes') {
      const notes = await supabase('control_bridge_notes?select=*&order=created_at.desc&limit=100');
      return send(res, 200, { notes });
    }

    if (req.method === 'POST' && url === '/api/agent-bridge/notes') {
      const input = await readJson(req);
      const fromAgent = String(input.from_agent || '').trim();
      const toAgent = String(input.to_agent || '').trim();
      const noteType = String(input.note_type || 'handoff').trim();
      const subject = String(input.subject || '').trim();
      const body = String(input.body || '').trim();
      if (!ALLOWED_AGENTS.has(fromAgent)) return send(res, 400, { error: 'Unsupported from_agent' });
      if (!toAgent || !ALLOWED_AGENTS.has(toAgent)) return send(res, 400, { error: 'Unsupported to_agent' });
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

    return send(res, 404, { error: 'Agent bridge route not found' });
  } catch (err) {
    return send(res, err.statusCode || 500, { error: err.message || 'Agent bridge failure' });
  }
}

module.exports = { handle, configured };
