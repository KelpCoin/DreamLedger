#!/usr/bin/env node
/**
 * Bounded, evidence-enforcing cloud job runner.
 * Command failure is FAIL; dependency absence is NOT_RUN; timeout is BLOCKED.
 * Never emits command stdout/stderr or credentials into proof files.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = process.cwd();
const MAX_TIMEOUT_MS = 300000;
const DEFAULT_TIMEOUT_MS = 120000;
const MAX_BUFFER_BYTES = 1024 * 1024;

export function parseCommand(command) {
  const parts = Array.isArray(command)
    ? command
    : (typeof command === 'string' ? command.trim().split(/\s+/) : []);
  if (!parts.length || parts.some((p) => typeof p !== 'string' || !p)) {
    return { ok: false, reason_code: 'COMMAND_INVALID' };
  }
  if (parts[0] !== 'node') return { ok: false, reason_code: 'EXECUTABLE_NOT_ALLOWLISTED' };
  if (parts.some((p) => /[;&|\x60$<>\n\r]/.test(p))) {
    return { ok: false, reason_code: 'SHELL_SYNTAX_FORBIDDEN' };
  }
  const args = parts.slice(1);
  if (!args.length) return { ok: false, reason_code: 'SCRIPT_PATH_REQUIRED' };
  if (args[0].startsWith('-') && args[0] !== '--test') {
    return { ok: false, reason_code: 'NODE_FLAG_NOT_ALLOWLISTED' };
  }
  const pathArgs = args[0] === '--test' ? args.slice(1) : args;
  if (!pathArgs.length) return { ok: false, reason_code: 'SCRIPT_PATH_REQUIRED' };
  for (const item of pathArgs) {
    if (item.startsWith('-')) continue;
    const resolved = path.resolve(process.cwd(), item);
    const root = process.cwd();
    if (path.isAbsolute(item) || (resolved !== root && !resolved.startsWith(root + path.sep)) || item.split(/[\\/]/).includes('..')) {
      return { ok: false, reason_code: 'SCRIPT_PATH_OUTSIDE_REPOSITORY' };
    }
  }
  return { ok: true, executable: 'node', args };
}

export function summarizeNodeTestOutput(output) {
  const pick = (names) => {
    for (const name of names) {
      const m = output.match(new RegExp('(?:#|ℹ)\\s*' + name + '\\s+(\\d+)', 'i'));
      if (m) return Number(m[1]);
    }
    return null;
  };
  const failedTests = [];
  for (const match of output.matchAll(/(?:^|\\n)\\s*✖\\s+([^\\r\\n(]+?)(?:\\s+\\([\\d.]+ms\\))?\\s*(?=\\r?\\n|$)/g)) {
    const name = String(match[1] || '').trim();
    if (name && !/^failing tests:$/i.test(name)) failedTests.push(name.slice(0, 180));
  }
  for (const match of output.matchAll(/(?:^|\\n)\\s*not ok \\d+\\s+-\\s+([^\\r\\n]+)/g)) {
    failedTests.push(String(match[1] || '').trim().slice(0, 180));
  }
  return {
    tests: pick(['tests?']),
    passed: pick(['pass(?:ed)?']),
    failed: pick(['fail(?:ed)?']),
    skipped: pick(['skipped']),
    failed_tests: [...new Set(failedTests)].slice(0, 20),
  };
}

export function classifyCommandResult(job, result, { evidenceExists = false, output = '' } = {}) {
  const errorCode = result?.error?.code || null;
  if (errorCode === 'ETIMEDOUT' || errorCode === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
    return { status: 'BLOCKED', reason_code: errorCode === 'ETIMEDOUT' ? 'EXECUTION_TIMEOUT' : 'OUTPUT_LIMIT_EXCEEDED' };
  }
  if (errorCode === 'ENOENT') return { status: 'NOT_RUN', reason_code: 'EXECUTOR_UNAVAILABLE' };
  if (job?.on_missing_secrets === 'NOT_RUN' &&
      /BLOCKED_MISSING_CONFIGURATION|BLOCKED_MISSING_SECRET|MISSING_ENV:/i.test(output)) {
    return { status: 'NOT_RUN', reason_code: 'MISSING_PROVIDER_CONFIGURATION' };
  }
  if (result?.status !== 0) {
    return { status: 'FAIL', reason_code: Number.isInteger(result?.status) ? 'COMMAND_EXIT_NONZERO' : 'EXECUTOR_RESULT_UNKNOWN' };
  }
  if (job?.evidence_mode !== 'runner_summary' && job?.evidence && !evidenceExists) {
    return { status: 'FAIL', reason_code: 'EVIDENCE_FILE_NOT_CREATED' };
  }
  if (job?.evidence_mode === 'runner_summary') {
    const stats = summarizeNodeTestOutput(output);
    if (!Number.isInteger(stats.tests) || stats.tests < 1) return { status: 'FAIL', reason_code: 'TEST_RESULT_SUMMARY_MISSING' };
    if (stats.failed !== null && stats.failed > 0) return { status: 'FAIL', reason_code: 'TESTS_FAILED' };
  }
  return { status: 'PASS', reason_code: 'EXECUTED_WITH_REQUIRED_EVIDENCE' };
}

function resolveRepoPath(relative) {
  const full = path.resolve(ROOT, String(relative || ''));
  if (full !== ROOT && !full.startsWith(ROOT + path.sep)) throw new Error('EVIDENCE_PATH_OUTSIDE_REPOSITORY');
  return full;
}

function hashText(s) {
  return crypto.createHash('sha256').update(String(s || ''), 'utf8').digest('hex');
}

function safeSummary(stdout, stderr) {
  const out = String(stdout || '');
  const err = String(stderr || '');
  return {
    stdout_bytes: Buffer.byteLength(out),
    stderr_bytes: Buffer.byteLength(err),
    stdout_sha256: hashText(out),
    stderr_sha256: hashText(err),
  };
}

function validTimeout(job) {
  const n = Number(job.timeout_ms ?? DEFAULT_TIMEOUT_MS);
  if (!Number.isInteger(n) || n < 1000 || n > MAX_TIMEOUT_MS) return null;
  return n;
}

async function main() {
  const manifestPath = path.join(ROOT, 'ops/beck/cloud-job-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const outPath = resolveRepoPath(process.env.BECK_PROOF_REPORT_PATH || 'proof/beck/latest-proof-report.json');
  const results = [];

  for (const job of manifest.jobs) {
    const began = new Date().toISOString();
    const startedMs = Date.now();
    const evidencePath = job.evidence ? resolveRepoPath(job.evidence) : null;
    const parsed = parseCommand(job.argv || job.command);
    const timeoutMs = validTimeout(job);
    let r = { status: null, stdout: '', stderr: '', error: null };
    let result;

    if (!parsed.ok) {
      result = { status: 'FAIL', reason_code: parsed.reason_code };
    } else if (!timeoutMs) {
      result = { status: 'FAIL', reason_code: 'JOB_TIMEOUT_CONFIGURATION_INVALID' };
    } else {
      const cwd = resolveRepoPath(job.cwd || '.');
      const env = { ...process.env, ...(job.env || {}) };
      if (job.evidence_env && job.evidence) env[job.evidence_env] = job.evidence;
      // No shell; bounded time and output; argv is machine data, not shell text.
      r = spawnSync(parsed.executable, parsed.args, {
        shell: false,
        cwd,
        env,
        encoding: 'utf8',
        timeout: timeoutMs,
        maxBuffer: MAX_BUFFER_BYTES,
        windowsHide: true,
      });
      const combined = String(r.stdout || '') + '\n' + String(r.stderr || '');
      result = classifyCommandResult(job, r, {
        evidenceExists: evidencePath ? fs.existsSync(evidencePath) : false,
        output: combined,
      });

      if (job.evidence_mode === 'runner_summary' && evidencePath) {
        const testSummary = summarizeNodeTestOutput(combined);
        const evidence = {
          schema: 'DREAMLEDGER-BECK-TEST-EVIDENCE/v1',
          job_id: job.id,
          observed_at_utc: new Date().toISOString(),
          commit_sha: process.env.GITHUB_SHA || null,
          run_id: process.env.GITHUB_RUN_ID || null,
          status: result.status,
          reason_code: result.reason_code,
          exit_code: r.status,
          timeout_ms: timeoutMs,
          duration_ms: Date.now() - startedMs,
          ...testSummary,
          ...safeSummary(r.stdout, r.stderr),
          production_mutation: false,
          revenue_claimed: false,
        };
        try {
          fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
          fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2) + '\n', 'utf8');
        } catch {
          result = { status: 'FAIL', reason_code: 'TEST_EVIDENCE_WRITE_FAILED' };
        }
      }
    }

    const durationMs = Date.now() - startedMs;
    const outputSummary = safeSummary(r.stdout, r.stderr);
    results.push({
      id: job.id,
      title: job.title,
      status: result.status,
      reason_code: result.reason_code,
      exit_code: Number.isInteger(r.status) ? r.status : null,
      duration_ms: durationMs,
      timeout_ms: timeoutMs,
      evidence_path: job.evidence || null,
      evidence_exists: evidencePath ? fs.existsSync(evidencePath) : false,
      output_bytes: outputSummary.stdout_bytes + outputSummary.stderr_bytes,
      output_sha256: hashText(outputSummary.stdout_sha256 + outputSummary.stderr_sha256),
      started_at_utc: began,
      finished_at_utc: new Date().toISOString(),
      production_mutation: false,
      revenue_claimed: false,
    });
  }

  const report = {
    schema: 'DREAMLEDGER-BECK-PROOF-REPORT/v1',
    observed_at_utc: new Date().toISOString(),
    commit_sha: process.env.GITHUB_SHA || null,
    run_id: process.env.GITHUB_RUN_ID || null,
    verified_external_revenue_nzd: 0,
    results,
    production_mutation: false,
    revenue_claimed: false,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(report, null, 2));
  process.exit(results.some((x) => x.status === 'FAIL') ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    // Keep exception text out of proof/logs; it might contain provider data.
    console.error(JSON.stringify({ status: 'FAIL', reason_code: 'RUNNER_INTERNAL_ERROR', error_class: error?.name || 'Error' }));
    process.exit(1);
  });
}
