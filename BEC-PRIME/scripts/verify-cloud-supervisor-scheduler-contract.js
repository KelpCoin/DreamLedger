#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../..');
const migrationPath = path.join(repoRoot, 'supabase/migrations/20261014190000_schedule_commerce_supervisor.sql');
const docsPath = path.join(repoRoot, 'docs/operations/CLOUD-SUPERVISOR-SCHEDULING.md');
const functionPath = path.join(repoRoot, 'supabase/functions/commerce-supervisor/index.ts');
const transitionPath = path.join(repoRoot, 'supabase/migrations/20261014191000_commerce_supervisor_atomic_transition.sql');
const migration = fs.readFileSync(migrationPath, 'utf8');
const docs = fs.readFileSync(docsPath, 'utf8');
const supervisor = fs.readFileSync(functionPath, 'utf8');
const transition = fs.readFileSync(transitionPath, 'utf8');
const checks = [];
function check(id, pass, detail) { checks.push({ id, status: pass ? 'PASS' : 'FAIL', detail }); }

check('uses-supabase-cron', migration.includes('cron.schedule(') && migration.includes("'*/15 * * * *'"), 'A 15-minute native Postgres Cron job is declared.');
check('uses-pg-net', migration.includes('net.http_post('), 'The job invokes the Edge Function through pg_net.');
check('calls-existing-supervisor', migration.includes('/functions/v1/commerce-supervisor'), 'The existing protected supervisor is the scheduled target.');
check('loads-key-from-vault', migration.includes('vault.decrypted_secrets') && migration.includes('dreamledger_supervisor_service_role_key'), 'Credential is read from Vault at execution time.');
check('never-embeds-secret', !/(sk_live_|sb_secret_|service_role\s*[:=]\s*['"][A-Za-z0-9_-]{30,}|eyJ[A-Za-z0-9_-]{60,})/.test(migration), 'No API key/JWT literal is embedded in migration source.');
check('fails-closed-without-key', migration.includes("raise exception 'Missing Vault secret"), 'Missing credential prevents unauthenticated invocation.');
check('operator-verification-documented', docs.includes('cron.job_run_details') && docs.includes('net._http_response'), 'Run history and outbound HTTP response inspection are documented.');
check('supervisor-source-versioned', supervisor.includes('dreamledger-commerce-supervisor/v2') && supervisor.includes('apply_commerce_supervisor_transition'), 'Versioned Edge Function uses the atomic transition RPC.');
check('service-role-only-handler', supervisor.includes('req.headers.get("authorization") === "Bearer " + serviceKey') && supervisor.includes('req.headers.get("apikey") === serviceKey'), 'Function rejects caller JWTs that are not the service-role credential.');
check('bounded-supervisor-scan', supervisor.includes('bounded_scan_limit: 50000') && supervisor.includes('exceeded_bounded_scan_limit'), 'Large data sets fail visibly instead of silently truncating at PostgREST default row limits.');
check('atomic-transition-migration', transition.includes('update public.commerce_cells') && transition.includes('insert into public.commerce_cell_state_events') && transition.includes('revoke all on function public.apply_commerce_supervisor_transition'), 'State update and audit insert share one transaction, and RPC is not granted to public users.');


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
