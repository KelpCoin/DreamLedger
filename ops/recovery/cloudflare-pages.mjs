#!/usr/bin/env node
/**
 * BECK Cloudflare Pages inspection/recovery adapter.
 * Default action is READ ONLY. Deploy-hook mutation requires explicit action
 * plus BECK_ALLOW_PRODUCTION_RECOVERY=true. No automatic POST retry.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const token = process.env.CLOUDFLARE_API_TOKEN;
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const project = process.env.CLOUDFLARE_PAGES_PROJECT;
const deployHook = process.env.CLOUDFLARE_DEPLOY_HOOK_URL || '';
const outPath = process.env.BECK_RECOVERY_EVIDENCE_PATH || 'proof/beck/latest-cloudflare-recovery.json';
const requestedAction = String(process.env.BECK_RECOVERY_ACTION || 'inspect').toLowerCase();
const mutationAllowed = process.env.BECK_ALLOW_PRODUCTION_RECOVERY === 'true';
const recoveryId = 'cf-' + crypto.randomUUID();
const apiBase = 'https://api.cloudflare.com/client/v4';

function writeProof(p) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(p, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(p, null, 2));
}
function finish(status, details = {}, code = 0) {
  writeProof({
    schema: 'BECK-CLOUDFLARE-RECOVERY/v2',
    observed_at_utc: new Date().toISOString(),
    recovery_id: recoveryId,
    provider: 'cloudflare_pages',
    requested_action: requestedAction,
    status,
    success: status === 'INSPECTED' || status === 'DEPLOY_REQUESTED_AWAITING_PROBE',
    mutation_allowed_by_policy: mutationAllowed,
    production_mutation: Boolean(details.action_taken),
    revenue_claimed_nzd: 0,
    ...details
  });
  process.exit(code);
}
async function api(method, url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      method, signal: controller.signal,
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' }
    });
    let body = null;
    try { body = await res.json(); } catch {}
    return { http_status: res.status, ok: res.ok, body };
  } catch (e) {
    return { http_status: 0, ok: false, error_class: e?.name || 'FetchError' };
  } finally { clearTimeout(timer); }
}
function allowlistedUrl(raw, predicate) {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && !u.username && !u.password && predicate(u.hostname) ? u : null;
  } catch { return null; }
}
async function probe(raw, predicate) {
  if (!raw) return { configured: false };
  const u = allowlistedUrl(raw, predicate);
  if (!u) return { configured: true, ok: false, http_status: 0, error_code: 'PROBE_URL_NOT_ALLOWLISTED' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(u, { method: 'GET', redirect: 'manual', signal: controller.signal, headers: { Accept: 'text/html,application/json' } });
    return { configured: true, host: u.hostname, path: u.pathname, http_status: res.status, ok: res.status >= 200 && res.status < 400 };
  } catch (e) {
    return { configured: true, host: u.hostname, path: u.pathname, http_status: 0, ok: false, error_class: e?.name || 'FetchError' };
  } finally { clearTimeout(timer); }
}

if (!['inspect', 'deploy'].includes(requestedAction)) finish('BLOCKED_UNKNOWN_ACTION', {
  error_code: 'UNKNOWN_RECOVERY_ACTION', action_taken: false
}, 2);
if (!token || !accountId || !project) finish('BLOCKED_MISSING_CONFIGURATION', {
  missing: [
    ...(!token ? ['CLOUDFLARE_API_TOKEN'] : []),
    ...(!accountId ? ['CLOUDFLARE_ACCOUNT_ID'] : []),
    ...(!project ? ['CLOUDFLARE_PAGES_PROJECT'] : [])
  ],
  action_taken: false
}, 2);

const root = apiBase + '/accounts/' + encodeURIComponent(accountId) + '/pages/projects/' + encodeURIComponent(project);
const deployments = await api('GET', root + '/deployments?per_page=1');
const domains = await api('GET', root + '/domains');
if (!deployments.ok || deployments.body?.success !== true) finish('BLOCKED_DEPLOYMENT_READ_FAILED', {
  deployments_http_status: deployments.http_status,
  error_class: deployments.error_class || null,
  action_taken: false
}, 2);

const latest = Array.isArray(deployments.body?.result) ? deployments.body.result[0] : null;
const latestSafe = latest ? {
  id: latest.id || null,
  short_id: latest.short_id || null,
  url: latest.url || null,
  environment: latest.environment || null,
  latest_stage: latest.latest_stage?.name || null,
  deployment_trigger: latest.deployment_trigger?.type || null,
  created_on: latest.created_on || null
} : null;
const previewRaw = process.env.CLOUDFLARE_PREVIEW_URL || (latest?.url ? 'https://' + String(latest.url).replace(/^https?:\/\//, '') : '');
const previewProbe = await probe(previewRaw, h => h.endsWith('.pages.dev'));
const publicProbe = await probe(process.env.CLOUDFLARE_CUSTOM_DOMAIN_URL || 'https://dreamledger.org/mtg/', h => h === 'dreamledger.org');

if (requestedAction === 'inspect') finish('INSPECTED', {
  account_configured: Boolean(accountId),
  pages_project: project,
  deployments_http_status: deployments.http_status,
  latest_deployment: latestSafe,
  domains_http_status: domains.http_status,
  domains_readable: domains.ok && domains.body?.success === true,
  configured_domains: Array.isArray(domains.body?.result) ? domains.body.result.map(d => ({
    name: d.name || null, status: d.status || null,
    validation_data_status: d.validation_data?.status || null
  })) : [],
  preview_probe: previewProbe,
  public_domain_probe: publicProbe,
  action_taken: false,
  note: 'Read-only status is not route parity. All dynamic API routes and DB read-back must pass independently.'
});

if (!mutationAllowed) finish('BLOCKED_MUTATION_POLICY', {
  latest_deployment: latestSafe,
  preview_probe: previewProbe,
  public_domain_probe: publicProbe,
  action_taken: false,
  error_code: 'BECK_ALLOW_PRODUCTION_RECOVERY_NOT_TRUE'
}, 2);
const hook = allowlistedUrl(deployHook, h => h === 'api.cloudflare.com');
if (!hook || !hook.pathname.includes('/pages/webhooks/deploy_hooks/')) finish('BLOCKED_DEPLOY_HOOK_NOT_VALIDATED', {
  latest_deployment: latestSafe,
  action_taken: false,
  error_code: 'CONFIGURE_VALID_CLOUDFLARE_DEPLOY_HOOK_URL'
}, 2);

// Exactly one state-changing request, followed by independent read-back. No retry.
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 15000);
let hookResult;
try {
  const res = await fetch(hook, { method: 'POST', redirect: 'manual', signal: controller.signal });
  hookResult = { http_status: res.status, ok: res.status >= 200 && res.status < 300 };
} catch (e) {
  hookResult = { http_status: 0, ok: false, error_class: e?.name || 'FetchError' };
} finally { clearTimeout(timer); }
const recheck = await api('GET', root + '/deployments?per_page=1');
const recheckLatest = recheck.ok && Array.isArray(recheck.body?.result) ? recheck.body.result[0] : null;
const afterPreview = await probe(recheckLatest?.url ? 'https://' + String(recheckLatest.url).replace(/^https?:\/\//, '') : process.env.CLOUDFLARE_PREVIEW_URL || '', h => h.endsWith('.pages.dev'));
const afterPublic = await probe(process.env.CLOUDFLARE_CUSTOM_DOMAIN_URL || 'https://dreamledger.org/mtg/', h => h === 'dreamledger.org');
finish(hookResult.ok && recheck.ok ? 'DEPLOY_REQUESTED_AWAITING_PROBE' : 'BLOCKED_DEPLOY_OR_READBACK_FAILED', {
  latest_deployment_before: latestSafe,
  deploy_hook_http_status: hookResult.http_status,
  deploy_hook_error_class: hookResult.error_class || null,
  latest_deployment_after: recheckLatest ? {
    id: recheckLatest.id || null, url: recheckLatest.url || null,
    environment: recheckLatest.environment || null,
    latest_stage: recheckLatest.latest_stage?.name || null,
    created_on: recheckLatest.created_on || null
  } : null,
  after_preview_probe: afterPreview,
  after_public_domain_probe: afterPublic,
  action_taken: hookResult.ok,
  deployment_requested: hookResult.ok,
  production_surface_verified: afterPublic.ok && afterPreview.ok,
  note: 'A successful deploy-hook response is not full acceptance. Required API routes and DB persistence/read-back remain independent gates.'
}, hookResult.ok && recheck.ok ? 0 : 2);
