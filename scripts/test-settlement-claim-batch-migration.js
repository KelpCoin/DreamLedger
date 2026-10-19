#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const migrationPath = path.join(
  __dirname,
  '..',
  'supabase',
  'migrations',
  '20261018000000_settlement_claim_batch.sql'
);
const sql = fs.readFileSync(migrationPath, 'utf8').toLowerCase().replace(/\s+/g, ' ');
const checks = [
  ['preserves table return contract', /returns table\s*\(\s*provider_event_id text\s*,\s*payload jsonb\s*,\s*attempt_count integer\s*\)/.test(sql)],
  ['not the empty JSONB stub', !/returns jsonb/.test(sql) && !/return '\[\]'::jsonb/.test(sql)],
  ['claims the existing durable queue', /from public\.processed_webhook_events/.test(sql)],
  ['uses skip-locked concurrency control', /for update skip locked/.test(sql)],
  ['validates worker identity', /worker id is required/.test(sql)],
  ['bounds batch size', /p_max < 1 or p_max > 100/.test(sql)],
  ['bounds lease seconds', /p_lease_secs < 5 or p_lease_secs > 3600/.test(sql)],
  ['sets processing lease owner and expiry', /lease_owner = p_worker_id/.test(sql) && /lease_expires_at = now\(\) \+ make_interval/.test(sql)],
  ['increments attempts atomically', /attempt_count = p\.attempt_count \+ 1/.test(sql)],
  ['revokes direct client execution', /revoke execute on function public\.settlement_claim_batch\(text, int, int\) from public, anon, authenticated/.test(sql)],
  ['grants queue claim only to service role', /grant execute on function public\.settlement_claim_batch\(text, int, int\) to service_role/.test(sql)],
  ['hardens search path', /security definer set search_path = ''/.test(sql)]
];

let failed = 0;
for (const [name, ok] of checks) {
  process.stdout.write((ok ? 'PASS ' : 'FAIL ') + name + '\n');
  if (!ok) failed += 1;
}
process.stdout.write('SETTLEMENT_CLAIM_BATCH_CONTRACT=' + (failed ? 'FAIL' : 'PASS') +
  ' checks=' + checks.length + ' failed=' + failed + '\n');
process.exitCode = failed ? 1 : 0;
