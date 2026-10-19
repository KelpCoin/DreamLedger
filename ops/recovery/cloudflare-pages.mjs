#!/usr/bin/env node
/**
 * BECK Cloudflare Pages recovery adapter.
 * Triggers a deployment (or reports domain status) via API.
 * Writes evidence. Never claims public surface healthy without probe.
 *
 * Required env:
 *   CLOUDFLARE_API_TOKEN
 *   CLOUDFLARE_ACCOUNT_ID
 *   CLOUDFLARE_PAGES_PROJECT
 * Optional:
 *   CLOUDFLARE_DEPLOY_HOOK_URL  (preferred simple trigger if configured)
 */
import fs from 'node:fs';
import crypto from 'node:crypto';

const token = process.env.CLOUDFLARE_API_TOKEN;
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const project = process.env.CLOUDFLARE_PAGES_PROJECT;
const deployHook = process.env.CLOUDFLARE_DEPLOY_HOOK_URL;
const outPath = process.env.BECK_RECOVERY_EVIDENCE_PATH || 'proof/beck/latest-cloudflare-recovery.json';

function writeEvidence(evidence) {
  fs.mkdirSync(outPath.replace(/[^/]+$/, ''), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify(evidence, null, 2));
}

const recoveryId = 'cf-' + crypto.randomUUID();

if (deployHook) {
  const res = await fetch(deployHook, { method: 'POST' });
  const success = res.status >= 200 && res.status < 300;
  writeEvidence({
    schema: 'BECK-CLOUDFLARE-RECOVERY/v1',
    recovery_id: recoveryId,
    provider: 'cloudflare_pages',
    action: 'deploy_hook',
    http_status: res.status,
    success,
    observed_at_utc: new Date().toISOString(),
    production_mutation: true,
    revenue_claimed_nzd: 0,
    note: success
      ? 'Deploy hook fired. Caller must re-probe origin and custom domain.'
      : 'Deploy hook failed.',
  });
  process.exit(success ? 0 : 1);
}

if (!token || !accountId || !project) {
  writeEvidence({
    schema: 'BECK-CLOUDFLARE-RECOVERY/v1',
    recovery_id: recoveryId,
    success: false,
    error: 'Missing CLOUDFLARE_DEPLOY_HOOK_URL or (CLOUDFLARE_API_TOKEN + ACCOUNT_ID + PAGES_PROJECT)',
    observed_at_utc: new Date().toISOString(),
    production_mutation: false,
    revenue_claimed_nzd: 0,
  });
  process.exit(1);
}

// List latest deployment as a status probe (redeploy via API requires more setup).
const listUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${project}/deployments?per_page=1`;
const res = await fetch(listUrl, {
  headers: {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  },
});

let body = null;
try {
  body = await res.json();
} catch {
  body = null;
}

const success = res.ok && body?.success === true;
const latest = body?.result?.[0] || null;

writeEvidence({
  schema: 'BECK-CLOUDFLARE-RECOVERY/v1',
  recovery_id: recoveryId,
  provider: 'cloudflare_pages',
  action: 'list_latest_deployment',
  http_status: res.status,
  success,
  latest_deployment_id: latest?.id || null,
  latest_status: latest?.latest_stage?.name || latest?.status || null,
  observed_at_utc: new Date().toISOString(),
  production_mutation: false,
  revenue_claimed_nzd: 0,
  note: success
    ? 'Status readable. Prefer CLOUDFLARE_DEPLOY_HOOK_URL for actual redeploy triggers.'
    : 'Could not read deployments. Check token scopes (Pages Read/Write).',
});

process.exit(success ? 0 : 1);
