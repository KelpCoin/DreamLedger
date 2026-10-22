import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCommand, summarizeNodeTestOutput, classifyCommandResult } from './run-cloud-jobs.mjs';

test('only allowlisted Node commands are accepted', () => {
  assert.equal(parseCommand('node ops/autonomy/run-revenue-spine-status.mjs').ok, true);
  assert.equal(parseCommand('node --test ops/beck/settlement-truth.test.mjs').ok, true);
  assert.equal(parseCommand('bash -c echo').reason_code, 'EXECUTABLE_NOT_ALLOWLISTED');
  assert.equal(parseCommand('node -e console.log(1)').reason_code, 'NODE_FLAG_NOT_ALLOWLISTED');
  assert.equal(parseCommand('node ops/ok.mjs; echo nope').reason_code, 'SHELL_SYNTAX_FORBIDDEN');
  assert.equal(parseCommand('node ../outside.mjs').reason_code, 'SCRIPT_PATH_OUTSIDE_REPOSITORY');
});

test('ordinary non-zero test command is FAIL even if legacy manifest says BLOCKED', () => {
  const r = classifyCommandResult(
    { on_fail: 'BLOCKED' },
    { status: 1, stdout: 'test failed', stderr: '' },
    { output: 'test failed', evidenceExists: true },
  );
  assert.deepEqual(r, { status: 'FAIL', reason_code: 'COMMAND_EXIT_NONZERO' });
});

test('timeout is BLOCKED with an exact reason', () => {
  const r = classifyCommandResult(
    {},
    { status: null, error: { code: 'ETIMEDOUT' } },
    {},
  );
  assert.deepEqual(r, { status: 'BLOCKED', reason_code: 'EXECUTION_TIMEOUT' });
});

test('missing provider configuration becomes NOT_RUN only with the declared policy', () => {
  const result = { status: 2, stdout: '{"status":"BLOCKED_MISSING_CONFIGURATION"}', stderr: '' };
  assert.deepEqual(
    classifyCommandResult({ on_missing_secrets: 'NOT_RUN' }, result, { output: result.stdout }),
    { status: 'NOT_RUN', reason_code: 'MISSING_PROVIDER_CONFIGURATION' },
  );
  assert.equal(
    classifyCommandResult({}, { status: 2, stdout: 'NEON connection refused', stderr: '' }, { output: 'NEON connection refused' }).status,
    'FAIL',
  );
});

test('successful command without required evidence file is FAIL', () => {
  const r = classifyCommandResult({ evidence: 'proof/x.json' }, { status: 0 }, { evidenceExists: false });
  assert.deepEqual(r, { status: 'FAIL', reason_code: 'EVIDENCE_FILE_NOT_CREATED' });
});

test('test command cannot PASS without a test summary', () => {
  const r = classifyCommandResult(
    { evidence_mode: 'runner_summary' },
    { status: 0 },
    { output: 'process exited successfully' },
  );
  assert.deepEqual(r, { status: 'FAIL', reason_code: 'TEST_RESULT_SUMMARY_MISSING' });
});

test('Node test summary is parsed without retaining raw test output', () => {
  const stats = summarizeNodeTestOutput('ℹ tests 7\nℹ pass 6\nℹ fail 1\nℹ skipped 0');
  assert.deepEqual(stats, { tests: 7, passed: 6, failed: 1, skipped: 0, failed_tests: [] });
  const r = classifyCommandResult(
    { evidence_mode: 'runner_summary' },
    { status: 0 },
    { output: 'ℹ tests 7\nℹ pass 6\nℹ fail 1\nℹ skipped 0' },
  );
  assert.deepEqual(r, { status: 'FAIL', reason_code: 'TESTS_FAILED' });
});
