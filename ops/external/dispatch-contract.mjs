export function validateSubmissionContract(spec) {
  if (!spec || typeof spec !== 'object') throw new Error('MISSING_BROWSER_ACTION_SPEC');
  if (spec.submit !== true) return { submit: false };

  if (!spec.submit_selector) throw new Error('MISSING_SUBMIT_SELECTOR');
  const hasFields = spec.fields && typeof spec.fields === 'object' && Object.keys(spec.fields).length > 0;
  if (!(spec.proposal_text || spec.body || hasFields)) throw new Error('MISSING_ACTION_PAYLOAD');
  if (!spec.success_selector && !spec.success_text) {
    throw new Error('MISSING_SUBMISSION_CONFIRMATION_CONTRACT');
  }
  return {
    submit: true,
    confirmation: spec.success_selector ? 'selector_visible' : 'success_text_observed'
  };
}

export function notDispatchedEvidence(evidence = {}) {
  return {
    dispatch_state: 'NOT_DISPATCHED',
    evidence: {
      ...evidence,
      submitted: false,
      target_observed: true
    }
  };
}
