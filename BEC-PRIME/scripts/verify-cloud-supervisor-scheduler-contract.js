#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../..');
const migrationPath = path.join(repoRoot, 'supabase/migrations/20261014190000_schedule_commerce_supervisor.sql');
const docsPath = path.join(repoRoot, 'docs/operations/CLOUD-SUPERVISOR-SCHEDULING.md');
const migration = fs.readFileSync(migrationPath, 'utf8');
const docs = fs.readFileSync(docsPath, 'utf8');
const checks = [];
function check(id, pass, detail) { checks.push({ id, status: pass ? 'PASS' : 'FAIL', detail }); }

check('uses-supabase-cron', migration.includes('cron.schedule(') && migration.includes("'*/15 * * * *'"), 'A 15-minute native Postgres Cron job is declared.');
check('uses-pg-net', migration.includes('net.http_post('), 'The job invokes the Edge Function through pg_net.');
check('calls-existing-supervisor', migration.includes('/functions/v1/commerce-supervisor'), 'The existing protected supervisor is the scheduled target.');
check('loads-key-from-vault', migration.includes('vault.decrypted_secrets') && migration.includes('dreamledger_supervisor_service_role_key'), 'Credential is read from Vault at execution time.');
check('never-embeds-secret', !/(sk_live_|sb_secret_|service_role\s*[:=]\s*['"][A-Za-z0-9_-]{30,}|eyJ[A-Za-z0-9_-]{60,})/.test(migration), 'No API key/JWT literal is embedded in migration source.');
check('fails-closed-without-key', migration.includes("raise exception 'Missing Vault secret"), 'Missing credential prevents unauthenticated invocation.');
check('operator-verification-documented', docs.includes('cron.job_run_details') && docs.includes('net._http_response'), 'Run history and outbound HTTP response inspection are documented.');

const failures = checks.filter(x => x.status === 'FAIL');
const proof = {
  schema: 'dreamledger/cloud-supervisor-scheduler-source-check/v1',
  status: failures.length ? 'FAIL' : 'PASS_SOURCE_CONTRACT_ONLY',
  runtime_active: false,
  checked_at: new Date().toISOString(),
  checks,
  limitations: [
    'This validates repository source only; it does not prove the migration was applied.',
    'It does not prove a Vault secret exists or that the production job has run.',
    'Live Supabase verification is required after deployment.'
  ]
};
console.log(JSON.stringify(proof, null, 2));
if (failures.length) process.exit(1);
