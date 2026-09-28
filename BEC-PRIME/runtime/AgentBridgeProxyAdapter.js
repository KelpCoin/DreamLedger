'use strict';
/**
 * SAFE minimal adapter after accidental truncation.
 * Full historical implementation: git blob f098790ed1f8275a524beb1c933624de504305c3
 * Restore with: git show f098790ed1f8:BEC-PRIME/runtime/AgentBridgeProxyAdapter.js
 */
const BRIDGE_SCHEMA_VERSION = 'BECK-AGENT-BRIDGE-1.3';
const EVENT_SCHEMA_VERSION = 'BECK-STRUCTURED-EVENT-1.1';

function send(res, status, body) {
  if (res.writableEnded) return true;
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(body));
  return true;
}

function configured() {
  const url = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const token = String(process.env.DREAMLEDGER_AGENT_BRIDGE_TOKEN || '');
  const proxy = String(process.env.AGENT_BRIDGE_PROXY_URL || '');
  return Boolean(url && token && proxy);
}

async function handle(req, res) {
  const url = String(req.url || '').split('?')[0];
  if (!url.startsWith('/api/agent-bridge')) return false;

  // Public discovery — no token (traffic anticipation)
  if (
    req.method === 'GET' &&
    (url === '/api/agent-bridge/health' ||
      url === '/api/agent-bridge/status' ||
      url === '/api/agent-bridge/public' ||
      url === '/api/agent-bridge/manifest')
  ) {
    return send(res, 200, {
      schema: 'dreamledger/agent-bridge-public/v1',
      service: 'DreamLedger',
      schema_version: BRIDGE_SCHEMA_VERSION,
      status: configured() ? 'public_ok_work_routes_limited' : 'degraded_missing_env',
      configured: configured(),
      authentication_required_for_work: true,
      authentication_header: 'x-dreamledger-agent-token',
      public_routes: [
        '/api/agent-bridge/manifest',
        '/api/agent-bridge/health',
        '/api/agent-bridge/status',
        '/api/agent-bridge/public',
        '/api/agent-bridge/rail/public',
        '/api/agent-bridge/rail/health'
      ],
      work_routes_note: 'Full job/event rail requires restored ProxyAdapter from blob f098790ed1f8',
      economic_truth: 'Bridge activity is not revenue',
      toll_catalog: 'https://dreamledger.org/bridge-tolls.json',
      shop: 'https://dreamledger.org/shop.html',
      offers: 'https://dreamledger.org/api/offers'
    });
  }

  if (req.method === 'GET' || req.method === 'POST') {
    return send(res, 503, {
      error: 'Agent bridge work routes temporarily limited — restore full AgentBridgeProxyAdapter from git blob f098790ed1f8275a524beb1c933624de504305c3',
      public: 'https://dreamledger.org/api/agent-bridge/public',
      toll_catalog: 'https://dreamledger.org/bridge-tolls.json'
    });
  }
  return send(res, 405, { error: 'Method not allowed' });
}

module.exports = {
  handle,
  configured,
  BRIDGE_SCHEMA_VERSION,
  EVENT_SCHEMA_VERSION,
  ALLOWED_AGENTS: new Set(['grok', 'claude', 'chatgpt', 'luna', 'deepseek', 'system', 'human']),
  STRUCTURED_EVENT_TYPES: new Set(['CANDIDATE_FOUND', 'COURT_REVIEW', 'ACTION_PROPOSED']),
  ROUTING_LANES: new Set(['discovery', 'evaluation', 'execution', 'payment']),
  claimJob: async () => null,
  completeJob: async () => null,
  failJob: async () => null,
  listJobs: async () => [],
  validateEventEnvelope: (i) => i,
  recordDoorwaySession: async () => null,
  normalizedJob: (j) => j
};
