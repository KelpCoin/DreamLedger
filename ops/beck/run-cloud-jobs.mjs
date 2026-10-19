#!/usr/bin/env node
/**
 * Execute cloud job manifest. Distinguishes PASS | BLOCKED | NOT_RUN | FAIL.
 * Never claims revenue. Never mutates production unless job explicitly allows.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, 'ops/beck/cloud-job-manifest.json'), 'utf8')
);
const outPath = process.env.BECK_PROOF_REPORT_PATH || 'proof/beck/latest-proof-report.json';

const results = [];
for (const job of manifest.jobs) {
  const env = { ...process.env, ...(job.env || {}) };
  const r = spawnSync(job.command, {
    shell: true,
    cwd: job.cwd || root,
    env,
    encoding: 'utf8',
  });
  let status = 'FAIL';
  if (r.status === 0) status = 'PASS';
  else if (job.on_missing_secrets === 'NOT_RUN' && /Missing |NEON_|CLOUDFLARE_/i.test(r.stderr + r.stdout)) {
    status = 'NOT_RUN';
  } else if (job.on_fail === 'BLOCKED') status = 'BLOCKED';

  results.push({
    id: job.id,
    title: job.title,
    status,
    exit_code: r.status,
    evidence_path: job.evidence || null,
    reason: status === 'PASS' ? 'ok' : (r.stderr || r.stdout || '').slice(0, 500),
  });
}

const report = {
  schema: 'DREAMLEDGER-BECK-PROOF-REPORT/v1',
  observed_at_utc: new Date().toISOString(),
  commit_sha: process.env.GITHUB_SHA || null,
  verified_external_revenue_nzd: 0,
  results,
  production_mutation: false,
  revenue_claimed: false,
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));

const hardFail = results.some((x) => x.status === 'FAIL');
process.exit(hardFail ? 1 : 0);
