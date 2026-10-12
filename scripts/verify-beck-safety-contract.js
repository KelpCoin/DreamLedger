'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');

const read = p => fs.readFileSync(p, 'utf8');
const controller = read('BEC-PRIME/autonomy/BEC-AUTONOMY-CONTROLLER.ps1');
const bootstrap = read('BEC-PRIME/scripts/Bootstrap-LMStudioCouncil.ps1');
const verifier = read('BEC-PRIME/scripts/Verify-LMStudioThreeRoleReadiness.ps1');
const orchestra = read('BEC-PRIME/scripts/Start-BECPrimeOrchestra.ps1');
const dailyWindows = read('scripts/beck-daily-bootstrap.ps1');
const dailyLinux = read('scripts/beck-daily-bootstrap.sh');
const dailyDiagnose = read('scripts/beck-daily-diagnose.sh');

function has(source, pattern, message) { assert.match(source, pattern, message); }
function lacks(source, pattern, message) { assert.doesNotMatch(source, pattern, message); }

has(controller, /IsPathRooted\(\$Path\)/, 'BECK controller must reject absolute paths');
has(controller, /Path escapes repository root/, 'BECK controller must fence paths to repository root');
has(controller, /\$full\.StartsWith\(\$a \+ \[IO\.Path\]::DirectorySeparatorChar/, 'Allowed paths must use separator-aware containment');
has(controller, /Denied unknown action/, 'Unknown model-selected actions must be denied');
has(controller, /workerMatches\.Count -ne 1/, 'Ambiguous or missing silo worker must fail closed');
has(controller, /RUN_GAUNTLET.*BLOCKED/s, 'Missing Gauntlet adapter must not report success');
has(controller, /CHECK_DEPLOYMENT.*BLOCKED/s, 'Missing deployment adapter must not report success');
has(controller, /CHECK_PAYMENT.*BLOCKED/s, 'Missing payment adapter must not report success');
has(controller, /status='UNVERIFIED'/, 'Internal telemetry must not be a PASS proof');
lacks(controller, /status='PASS';silo=\$Worker\.silo;action=\$Decision\.action/, 'Controller must not emit success-looking proof for an arbitrary cycle');

has(bootstrap, /Verify-LMStudioThreeRoleReadiness\.ps1/, 'Windows council bootstrap must invoke real-inference verifier');
has(bootstrap, /verifierExit -ne 0/, 'Verifier failure must block readiness');
has(bootstrap, /readiness\.status -ne 'PASS'/, 'Missing or failed verifier proof must block readiness');
has(bootstrap, /Select-Object -Unique/, 'Core roles must be distinct model keys');
has(verifier, /v1\/chat\/completions/, 'Each role must exercise actual inference');
has(verifier, /Select-Object -Unique/, 'Verifier must require distinct models');
has(verifier, /lms ps/, 'Verifier must inspect loaded models rather than treating /v1/models as residency proof');
has(verifier, /notLoaded\.Count/, 'Verifier must fail if a role model was evicted');
has(verifier, /THREE_DISTINCT_ROLES_INFERENCE_AND_LOADED_STATE_VERIFIED/, 'Verifier PASS must name its loaded-state evidence contract');

has(orchestra, /\[switch\]\$StartSwarm/, 'Swarm start must be an explicit operator option');
has(orchestra, /if \(\$StartSwarm\)/, 'Swarm must be gated by explicit switch');
has(orchestra, /\[switch\]\$RunRevenueCycle/, 'Revenue cycle must be opt-in');
has(orchestra, /if \(\$RunRevenueCycle\)/, 'Revenue cycle must be gated by explicit switch');
has(orchestra, /DEFERRED_BY_DEFAULT/, 'Swarm must be deferred by default');

has(dailyWindows, /Set-StrictMode -Version Latest/, 'Windows bootstrap must use strict mode');
has(dailyWindows, /ErrorActionPreference = 'Stop'/, 'Windows bootstrap must stop on unexpected errors');
has(dailyWindows, /bootstrap-proof\.json/, 'Windows bootstrap must persist machine-readable proof');
has(dailyWindows, /PREPARED_NOT_COMMISSIONED/, 'Workspace preparation must not claim runtime commissioning');
has(dailyWindows, /NOT_RUN_BY_DAILY_BOOTSTRAP/, 'Model-list reachability must not be represented as inference');
has(dailyWindows, /authenticated_sql='NOT_TESTED'/, 'Gateway response must not claim authenticated database health');
has(dailyLinux, /SUPABASE_STATUS=BLOCKED/, 'Linux bootstrap must report service blockers');
has(dailyLinux, /DB\/RPC health UNPROVEN/, 'Gateway reachability must not be treated as DB health');
lacks(dailyLinux, /curl\s+[^\n]*(?:-X\s*(?:POST|PATCH|PUT|DELETE)|--request\s+(?:POST|PATCH|PUT|DELETE))/i, 'Daily bootstrap must not mutate Supabase');
has(dailyDiagnose, /READ_ONLY=1/, 'Daily diagnostic must declare read-only behavior');
lacks(dailyDiagnose, /curl\s+[^\n]*(?:-X\s*(?:POST|PATCH|PUT|DELETE)|--request\s+(?:POST|PATCH|PUT|DELETE))/i, 'Daily diagnostic must not mutate Supabase');

console.log('BECK_SAFETY_CONTRACT=PASS');
console.log('Scope: static safety invariants only; does not prove local runtime, Supabase health, production deployment, payment, or revenue.');
