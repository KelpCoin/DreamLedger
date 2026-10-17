'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const contracts = path.join(ROOT, 'contracts', 'lmster');
const checks = [];

function check(name, fn) {
  try {
    fn();
    checks.push({ name, status: 'PASS' });
  } catch (error) {
    checks.push({ name, status: 'FAIL', detail: String(error && error.message || error) });
  }
}

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(contracts, name), 'utf8'));
}

const job = readJson('job-envelope.schema.json');
const tri = readJson('tri-llm-result.schema.json');
const receipt = readJson('evidence-receipt.schema.json');
const openapi = fs.readFileSync(path.join(contracts, 'gateway.openapi.yaml'), 'utf8');
const contract = fs.readFileSync(path.resolve(ROOT, '..', 'docs', 'LMSTER-HEADLESS-WORKER-CONTRACT.md'), 'utf8');
const launcher = fs.readFileSync(path.join(__dirname, 'Start-LMSTER-Headless.ps1'), 'utf8');
const installer = fs.readFileSync(path.join(__dirname, 'Install-LMSTER-StartupTask.ps1'), 'utf8');

check('JOB_SCHEMA_STRICT', () => {
  assert.equal(job.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.equal(job.additionalProperties, false);
  for (const key of ['job_id', 'idempotency_key', 'lease_id', 'lease_generation', 'silo_id', 'namespace', 'manifest_digest', 'input_sha256', 'prompt_pack_sha256', 'allowed_models', 'resource_limits']) {
    assert.ok(job.required.includes(key), 'missing job field: ' + key);
  }
  assert.deepEqual(job.properties.allowed_models.required, ['extractor', 'critic', 'synthesizer']);
  assert.deepEqual(job.properties.task_type.enum, ['TRI_LLM_EVIDENCE_REVIEW', 'QUOTE_NORMALIZE_TEST', 'SOURCE_EXTRACTION_TEST']);
  assert.equal(job.properties.worker_id.const, 'lmster-local-01');
});

check('TRI_LLM_FAIL_CLOSED', () => {
  assert.equal(tri.additionalProperties, false);
  assert.ok(tri.properties.policy_verdict.enum.includes('UNVERIFIED'));
  assert.ok(tri.properties.policy_verdict.enum.includes('BLOCKED'));
  assert.ok(tri.allOf.some(rule =>
    rule.if?.properties?.policy_verdict?.const === 'VERIFIED_MATCH' &&
    rule.then?.properties?.stage_results?.properties?.critic?.properties?.decision?.const === 'PASS'
  ), 'VERIFIED_MATCH must be conditional on critic PASS');
});

check('RECEIPT_BINDS_JOB_SILO_AND_MODELS', () => {
  assert.equal(receipt.additionalProperties, false);
  for (const key of ['job_id', 'idempotency_key', 'lease_id', 'lease_generation', 'worker_id', 'silo_id', 'namespace', 'manifest_digest', 'input_sha256', 'output_sha256', 'prompt_pack_sha256', 'model_records', 'stage_verdicts', 'deterministic_checks', 'policy_verdict', 'checkpoint_refs', 'receipt_sha256']) {
    assert.ok(receipt.required.includes(key), 'missing receipt field: ' + key);
  }
  assert.ok(receipt.allOf.some(rule =>
    rule.if?.properties?.policy_verdict?.const === 'VERIFIED_MATCH' &&
    rule.then?.properties?.stage_verdicts?.properties?.critic?.const === 'PASS'
  ), 'verified receipt requires every stage to PASS');
});

check('GATEWAY_IS_NARROW_AND_AUTHENTICATED', () => {
  for (const route of ['/claim:', '/input:', '/renew:', '/heartbeat:', '/checkpoint:', '/complete:', '/fail:']) {
    assert.ok(openapi.includes(route), 'missing gateway route ' + route);
  }
  assert.ok(/scheme:\s*bearer/.test(openapi), 'gateway must require bearer authentication');
  assert.ok(/not evidence of a deployed service/i.test(openapi), 'spec must identify itself as undeployed');
  assert.ok(/does not mark payment settled/i.test(openapi), 'complete endpoint must not imply settlement');
});

check('NO_REVENUE_AUTHORITY_GRANTED_TO_LOCAL_WORKER', () => {
  assert.match(contract, /worker is an execution node, not an economic authority/i);
  assert.match(contract, /NO_VERIFIED_TRANSACTION_NO_CLONING/);
  assert.match(contract, /never make payment processing dependent on local availability/i);
  assert.match(contract, /Do not hand its broad credential to the local worker/i);
});

check('LOCAL_API_BINDS_LOOPBACK_ONLY', () => {
  assert.match(launcher, /--bind",\s*"127\.0\.0\.1"/);
  assert.match(launcher, /No cloud job was claimed/);
  assert.doesNotMatch(launcher, /0\.0\.0\.0/);
});

check('STARTUP_TASK_IS_CURRENT_USER_AND_LIMITED', () => {
  assert.match(installer, /New-ScheduledTaskPrincipal.*LogonType Interactive.*RunLevel Limited/);
  assert.match(installer, /does not yet start a cloud queue consumer/);
  assert.doesNotMatch(installer, /Register-ScheduledTask.*SYSTEM/i);
});

const result = {
  schema: 'DREAMLEDGER/LMSTER-CONTRACT-VERIFICATION/v1',
  status: checks.every(x => x.status === 'PASS') ? 'PASS' : 'FAIL',
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== 'PASS') process.exitCode = 1;
