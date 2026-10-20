import test from 'node:test';
import assert from 'node:assert/strict';
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
