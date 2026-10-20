import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { notDispatchedEvidence, validateSubmissionContract } from '../ops/external/dispatch-contract.mjs';

test('page observation or form preparation is NOT_DISPATCHED', () => {
  const result = notDispatchedEvidence({ url: 'https://example.com', title: 'Example' });
  assert.equal(result.dispatch_state, 'NOT_DISPATCHED');
  assert.equal(result.evidence.submitted, false);
});

test('submit is rejected without positive confirmation contract', () => {
  assert.throws(
    () => validateSubmissionContract({
      submit: true, submit_selector: 'button[type=submit]', proposal_text: 'prepared'
    }),
    /MISSING_SUBMISSION_CONFIRMATION_CONTRACT/
  );
});

test('submit requires target, payload, and confirmation contract', () => {
  assert.deepEqual(
    validateSubmissionContract({
      submit: true,
      submit_selector: 'button[type=submit]',
      proposal_text: 'approved public post',
      success_selector: '[data-submitted=true]'
    }),
    { submit: true, confirmation: 'selector_visible' }
  );
});

test('empty form fields are not a submission payload', () => {
  assert.throws(
    () => validateSubmissionContract({
      submit: true, submit_selector: 'button[type=submit]', fields: {}
    }),
    /MISSING_ACTION_PAYLOAD/
  );
});

test('scheduled social distribution is suppressed if the public doorway is unhealthy', () => {
  const workflowPath = new URL('../.github/workflows/777-social-distribution.yml', import.meta.url);
  const workflow = readFileSync(workflowPath, 'utf8');
  const health = workflow.indexOf('Confirm public acquisition doorway is healthy before posting');
  const tumblr = workflow.indexOf('Publish to Tumblr when credentials are configured');
  const x = workflow.indexOf('Publish to X when credentials are configured');
  assert.ok(health >= 0 && health < tumblr && health < x, 'health check must run before all social publishers');
  const guardedPublishers = workflow.match(/if: steps\.target_health\.outputs\.healthy == 'true'/g) || [];
  assert.equal(guardedPublishers.length, 2, 'both Tumblr and X must require a healthy doorway');
  assert.ok(workflow.includes('SKIP_UNHEALTHY_DOORWAY'), 'unhealthy door must be explicitly recorded');
});
