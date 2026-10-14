'use strict';

const fs = require('node:fs');
const assert = require('node:assert/strict');
const workflow = fs.readFileSync('.github/workflows/777-economic-search.yml', 'utf8');
const heartbeat = fs.readFileSync('.github/workflows/beck-cloud-truth-heartbeat.yml', 'utf8');
const localHeartbeat = fs.readFileSync('scripts/beck-heartbeat.ps1', 'utf8');

function has(source, pattern, message) {
  assert.match(source, pattern, message);
}

has(workflow, /database_ready:\s*\$\{\{ steps\.check\.outputs\.database_ready \}\}/,
  'Preflight must expose database reachability separately from secret presence.');
has(workflow, /\/rest\/v1\/cortex_heartbeat\?select=seq&limit=1/,
  'Preflight must use a read-only query to test PostgREST/database reachability.');
has(workflow, /if: always\(\)/,
  'Cloud-independent validation must still run when Supabase credentials are absent.');
has(workflow, /if: needs\.preflight\.outputs\.database_ready == 'true'[\s\S]*?name: Refresh public demand radar/,
  'Demand-radar database writes must be gated on the preflight database probe.');
has(workflow, /name: Record skipped demand radar honestly[\s\S]*?CUBE_RADAR=BLOCKED_SUPABASE_UNAVAILABLE/,
  'A skipped database-backed radar must be explicitly labelled blocked, never passed.');
has(workflow, /name: Bridge 777 acceptance into commerce substrate[\s\S]*?if: needs\.preflight\.outputs\.database_ready == 'true'/,
  'Commerce handoff must not run when the database is known unavailable.');
has(workflow, /name: Run economic activation from 777 handoff[\s\S]*?if: needs\.preflight\.outputs\.database_ready == 'true'/,
  'Economic activation must not run when the database is known unavailable.');
has(workflow, /name: Test local LM Studio economic worker contract/,
  'Local worker contract tests must remain part of cloud-independent validation.');
has(heartbeat, /side_effects:[\s\S]*?public_posts:false[\s\S]*?checkout_attempts:false[\s\S]*?deploy_triggered:false/,
  'Cloud heartbeat must remain read-only.');
has(localHeartbeat, /Read-only diagnostics only/,
  'Local heartbeat must explicitly state its read-only boundary.');
has(localHeartbeat, /VERIFIED_10000/,
  'Local technical score must require every weighted check to pass.');
assert.doesNotMatch(workflow, /STRIPE_SECRET_KEY\s*=\s*['"][^'"]+['"]/,
  'Workflow must not hard-code Stripe secrets.');

console.log('BECK_DEGRADED_RUNTIME_CONTRACT=PASS');
console.log('Scope: static workflow and safety contract only; does not prove Supabase, LM Studio, production deployment, payment, or revenue.');
