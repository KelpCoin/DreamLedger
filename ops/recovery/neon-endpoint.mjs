#!/usr/bin/env node
/**
 * BECK Neon endpoint inspection/recovery adapter.
 * Default is READ ONLY. Mutation requires an explicit action plus
 * BECK_ALLOW_PRODUCTION_RECOVERY=true in a trusted protected environment.
 * Provider API success is not SQL connectivity or persistence proof.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const apiKey = process.env.NEON_API_KEY;
const projectId = process.env.NEON_PROJECT_ID;
const endpointId = process.env.NEON_ENDPOINT_ID;
const base = 'https://console.neon.tech/api/v2';
const outPath = process.env.BECK_RECOVERY_EVIDENCE_PATH || 'proof/beck/latest-neon-recovery.json';
const requestedAction = String(process.env.BECK_RECOVERY_ACTION || 'inspect').toLowerCase();
const mutationAllowed = process.env.BECK_ALLOW_PRODUCTION_RECOVERY === 'true';
const recoveryId = 'neon-' + crypto.randomUUID();

function writeProof(p) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(p, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(p, null, 2));
}
function finish(status, details = {}, code = 0) {
  writeProof({
    schema: 'BECK-NEON-RECOVERY/v2',
    observed_at_utc: new Date().toISOString(),
    recovery_id: recoveryId,
    provider: 'neon',
    requested_action: requestedAction,
    status,
    success: status === 'INSPECTED' || status === 'RECOVERY_REQUESTED_AWAITING_DB_READBACK',
    mutation_allowed_by_policy: mutationAllowed,
    production_mutation: Boolean(details.action_taken),
    database_connectivity_verified: false,
    database_write_readback_verified: false,
    required_follow_up: 'Independently prove SQL connectivity, correlated write/read-back, idempotency and backup/restore. An endpoint status response is not DB health.',
    revenue_claimed_nzd: 0,
    ...details
  });
  process.exit(code);
}
function summarize(body) {
  const e = body?.endpoint || body?.result?.endpoint || body?.result || body || {};
  return {
    id: e.id || e.endpoint_id || null,
    state: e.current_state || e.state || e.status || e.endpoint_state || null,
    type: e.type || null,
    region_id: e.region_id || null,
    host_present: typeof e.host === 'string' && e.host.length > 0
  };
}
async function api(method, url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      method, signal: controller.signal,
      headers: { Authorization: 'Bearer ' + apiKey, Accept: 'application/json', 'Content-Type': 'application/json' }
    });
    let body = null;
    try { body = await res.json(); } catch {}
    return { http_status: res.status, ok: res.ok, body };
  } catch (e) {
    return { http_status: 0, ok: false, error_class: e?.name || 'FetchError' };
  } finally { clearTimeout(timer); }
}

if (!apiKey || !projectId || !endpointId) {
  finish('BLOCKED_MISSING_CONFIGURATION', {
    missing: [
      ...(!apiKey ? ['NEON_API_KEY'] : []),
      ...(!projectId ? ['NEON_PROJECT_ID'] : []),
      ...(!endpointId ? ['NEON_ENDPOINT_ID'] : [])
    ],
    action_taken: false
  }, 2);
}
if (!['inspect', 'start', 'restart', 'recover'].includes(requestedAction)) {
  finish('BLOCKED_UNKNOWN_ACTION', { error_code: 'UNKNOWN_RECOVERY_ACTION', action_taken: false }, 2);
}

const endpointUrl = base + '/projects/' + encodeURIComponent(projectId) + '/endpoints/' + encodeURIComponent(endpointId);
const before = await api('GET', endpointUrl);
if (!before.ok) finish('BLOCKED_ENDPOINT_READ_FAILED', {
  before_http_status: before.http_status, error_class: before.error_class || null, action_taken: false
}, 2);
const beforeState = summarize(before.body);
if (requestedAction === 'inspect') finish('INSPECTED', {
  before: beforeState, before_http_status: before.http_status, action_taken: false
});
if (!mutationAllowed) finish('BLOCKED_MUTATION_POLICY', {
  before: beforeState, before_http_status: before.http_status,
  action_taken: false, error_code: 'BECK_ALLOW_PRODUCTION_RECOVERY_NOT_TRUE'
}, 2);

const state = String(beforeState.state || '').toLowerCase();
let action = requestedAction;
if (requestedAction === 'recover') {
  if (['idle', 'suspended', 'sleeping', 'stopped'].includes(state)) action = 'start';
  else if (['active', 'ready', 'running'].includes(state)) action = 'restart';
  else finish('BLOCKED_UNKNOWN_ENDPOINT_STATE', {
    before: beforeState, action_taken: false, error_code: 'ENDPOINT_STATE_NOT_RECOGNIZED'
  }, 2);
}
if (action === 'start' && !['idle', 'suspended', 'sleeping', 'stopped'].includes(state)) {
  finish('BLOCKED_START_STATE_MISMATCH', { before: beforeState, action_taken: false }, 2);
}
if (action === 'restart' && !['active', 'ready', 'running'].includes(state)) {
  finish('BLOCKED_RESTART_STATE_MISMATCH', { before: beforeState, action_taken: false }, 2);
}

// Exactly one mutating request. Never retry POST automatically.
const mutation = await api('POST', endpointUrl + '/' + action);
const after = await api('GET', endpointUrl);
finish(mutation.ok && after.ok ? 'RECOVERY_REQUESTED_AWAITING_DB_READBACK' : 'BLOCKED_RECOVERY_OR_READBACK_FAILED', {
  before: beforeState,
  after: after.ok ? summarize(after.body) : null,
  before_http_status: before.http_status,
  action: action,
  action_http_status: mutation.http_status,
  action_error_class: mutation.error_class || null,
  after_http_status: after.http_status,
  after_error_class: after.error_class || null,
  action_taken: mutation.ok,
  post_action_state_readback: after.ok,
  note: 'No POST retry was attempted. Endpoint API read-back does not prove SQL connectivity or persistence.'
}, mutation.ok && after.ok ? 0 : 2);
