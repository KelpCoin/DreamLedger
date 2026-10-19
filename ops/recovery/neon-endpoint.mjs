#!/usr/bin/env node
/**
 * BECK Neon compute recovery adapter.
 * Restarts / wakes a Neon endpoint via Management API.
 * Writes evidence. Never claims health without proof.
 *
 * Required env:
 *   NEON_API_KEY
 *   NEON_PROJECT_ID
 *   NEON_ENDPOINT_ID   (compute endpoint id)
 * Optional:
 *   NEON_API_BASE (default https://console.neon.tech/api/v2)
 */
import fs from 'node:fs';
import crypto from 'node:crypto';

const apiKey = process.env.NEON_API_KEY;
const projectId = process.env.NEON_PROJECT_ID;
const endpointId = process.env.NEON_ENDPOINT_ID;
const base = (process.env.NEON_API_BASE || 'https://console.neon.tech/api/v2').replace(/\/$/, '');
const outPath = process.env.BECK_RECOVERY_EVIDENCE_PATH || 'proof/beck/latest-neon-recovery.json';

function fail(msg, extra = {}) {
  const evidence = {
    schema: 'BECK-NEON-RECOVERY/v1',
    observed_at_utc: new Date().toISOString(),
    success: false,
    error: msg,
    ...extra,
    production_mutation: false,
    revenue_claimed_nzd: 0,
  };
  fs.mkdirSync(outPath.replace(/[^/]+$/, ''), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(evidence, null, 2) + '\n');
  console.error(JSON.stringify(evidence, null, 2));
  process.exit(1);
}

if (!apiKey || !projectId || !endpointId) {
  fail('Missing NEON_API_KEY, NEON_PROJECT_ID, or NEON_ENDPOINT_ID');
}

const recoveryId = 'neon-' + crypto.randomUUID();
const url = `${base}/projects/${projectId}/endpoints/${endpointId}/restart`;

const res = await fetch(url, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${apiKey}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

let body = null;
try {
  body = await res.json();
} catch {
  body = null;
}

const success = res.status >= 200 && res.status < 300;
const evidence = {
  schema: 'BECK-NEON-RECOVERY/v1',
  recovery_id: recoveryId,
  provider: 'neon',
  action: 'endpoint_restart',
  project_id: projectId,
  endpoint_id: endpointId,
  http_status: res.status,
  success,
  response_keys: body && typeof body === 'object' ? Object.keys(body) : [],
  observed_at_utc: new Date().toISOString(),
  production_mutation: true,
  revenue_claimed_nzd: 0,
  note: success
    ? 'Restart requested. Caller must re-probe DB connectivity and heartbeat read-back.'
    : 'Restart request failed. Surface remains BLOCKED.',
};

fs.mkdirSync(outPath.replace(/[^/]+$/, ''), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify(evidence, null, 2));
process.exit(success ? 0 : 1);
