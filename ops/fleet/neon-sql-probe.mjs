#!/usr/bin/env node
/**
 * Read-only Neon SQL probe. Uses psql installed by the workflow.
 * The connection URL, password and raw provider errors are never written to proof.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function result(status, details = {}) {
  return {
    schema: 'dreamledger.beck-neon-sql-probe/v1',
    checked_at_utc: new Date().toISOString(),
    status,
    healthy: status === 'CONNECTED',
    recoverable: status === 'CONNECTIVITY_FAILURE',
    query: 'SELECT 1',
    database_mutation: false,
    revenue_claimed_nzd: 0,
    ...details
  };
}

function classify(stderr, processError) {
  const text = String(stderr || '').toLowerCase();
  if (processError?.code === 'ETIMEDOUT' || /timeout|timed out|connection refused|could not connect|no route to host|network is unreachable|server closed the connection unexpectedly/.test(text)) {
    return 'CONNECTIVITY_FAILURE';
  }
  if (/password authentication failed|authentication failed|no password supplied|role .* does not exist|permission denied/.test(text)) {
    return 'AUTHENTICATION_OR_PERMISSION_FAILURE';
  }
  if (/does not exist|invalid connection option|invalid uri|ssl/.test(text)) {
    return 'CONFIGURATION_FAILURE';
  }
  if (processError) return 'PROBE_PROCESS_FAILURE';
  return 'QUERY_FAILURE';
}

function probe(raw) {
  if (!raw || !raw.trim()) return result('BLOCKED_CONFIGURATION', { error_class: 'NEON_DATABASE_URL_MISSING' });
  let u;
  try {
    u = new URL(raw);
    if (!['postgres:', 'postgresql:'].includes(u.protocol) || !u.hostname || !u.username || !u.pathname || u.pathname === '/') {
      return result('BLOCKED_CONFIGURATION', { error_class: 'NEON_DATABASE_URL_INVALID' });
    }
  } catch {
    return result('BLOCKED_CONFIGURATION', { error_class: 'NEON_DATABASE_URL_INVALID' });
  }

  const env = {
    ...process.env,
    PGHOST: u.hostname,
    PGPORT: u.port || '5432',
    PGDATABASE: decodeURIComponent(u.pathname.slice(1)),
    PGUSER: decodeURIComponent(u.username),
    PGPASSWORD: decodeURIComponent(u.password),
    PGSSLMODE: 'require',
    PGCONNECT_TIMEOUT: '8'
  };
  const p = spawnSync('psql', ['-X', '-w', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', 'SELECT 1'], {
    env, encoding: 'utf8', timeout: 12000, maxBuffer: 4096, stdio: ['ignore', 'pipe', 'pipe']
  });
  if (p.status === 0 && String(p.stdout || '').trim() === '1') {
    return result('CONNECTED', { select_1_passed: true, host_present: true });
  }
  return result(classify(p.stderr, p.error), {
    select_1_passed: false,
    host_present: true,
    error_class: p.error?.code === 'ENOENT' ? 'PSQL_NOT_INSTALLED' : classify(p.stderr, p.error)
  });
}

const out = probe(process.env.NEON_DATABASE_URL);
console.log(JSON.stringify(out, null, 2));
if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, 'healthy=' + String(out.healthy) + '\n', 'utf8');
  fs.appendFileSync(process.env.GITHUB_OUTPUT, 'recoverable=' + String(out.recoverable) + '\n', 'utf8');
  fs.appendFileSync(process.env.GITHUB_OUTPUT, 'status=' + out.status + '\n', 'utf8');
}
const proofPath = process.env.BECK_NEON_PROBE_PATH || 'proof/fleet/neon-sql-probe.json';
fs.mkdirSync(path.dirname(proofPath), { recursive: true });
fs.writeFileSync(proofPath, JSON.stringify(out, null, 2) + '\n', 'utf8');
process.exitCode = out.healthy ? 0 : out.status === 'BLOCKED_CONFIGURATION' ? 2 : 1;
