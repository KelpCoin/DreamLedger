#!/usr/bin/env node
/**
 * Read-only autonomy revenue spine status.
 * Does not claim revenue. Does not contact Stripe live unless env allows.
 * Exit 0 always after writing evidence (status may be BLOCKED).
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const jobsPath = path.join(root, 'ops/autonomy/REVENUE-ENGINE-JOBS.json');
const outPath = process.env.AUTONOMY_STATUS_PATH || 'proof/autonomy/latest-spine-status.json';

const jobsDoc = JSON.parse(fs.readFileSync(jobsPath, 'utf8'));
const open = jobsDoc.jobs.filter((j) => j.status === 'OPEN');
const blocked = jobsDoc.jobs.filter((j) => String(j.status).startsWith('BLOCKED'));
const l3 = jobsDoc.jobs.find((j) => j.id === 'REV-010');

const report = {
  schema: 'DREAMLEDGER-AUTONOMY-SPINE-STATUS/v1',
  observed_at_utc: new Date().toISOString(),
  verified_external_revenue_nzd: 0,
  human_builder_forbidden: true,
  current_target_level: 'L3',
  l3_status: l3?.status || 'UNKNOWN',
  open_job_ids: open.map((j) => j.id),
  blocked_job_ids: blocked.map((j) => j.id),
  priority_rule: jobsDoc.priority_rule,
  ball_c: {
    name: 'First external live purchase',
    job_id: 'REV-010',
    note: 'Cannot be closed by agents alone. Requires real external buyer + fossil.',
  },
  infra_parallel: ['REV-020', 'REV-021'],
  production_mutation: false,
  revenue_claimed: false,
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
