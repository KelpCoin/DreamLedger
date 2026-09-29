'use strict';
const assert = require('node:assert/strict');
const { validateRDTIQualification } = require('../BEC-PRIME/routes/consultDecision');

const base = {
  need: 'reviewer-pack',
  project_description: 'We need to organize the engineering records for a software development project.',
  repository_url: 'https://github.com/example/technical-project',
  repository_authority: 'authorized',
  relevant_period: '2025-2026',
  adviser_status: 'engaged',
  respondent_role: 'claimant',
  authorized_submission: true,
  storage_consent: true
};
const valid = validateRDTIQualification(base);
assert.equal(valid.ok, true);
assert.equal(valid.value.commercial_status, 'UNQUOTED');
assert.equal(valid.value.external_contact_authorized, false);
assert.equal(valid.value.payment_status, 'NOT_REQUESTED');

for (const key of ['authorized_submission', 'storage_consent']) {
  const invalid = validateRDTIQualification({ ...base, [key]: false });
  assert.equal(invalid.ok, false, key + ' must be mandatory');
}
assert.equal(validateRDTIQualification({ ...base, repository_authority: 'not-authorized' }).ok, false);
assert.equal(validateRDTIQualification({ ...base, project_description: 'too short' }).ok, false);
assert.equal(validateRDTIQualification({ ...base, repository_url: 'http://github.com/example/repo' }).ok, false);
assert.equal(validateRDTIQualification({ ...base, repository_url: 'https://evil.example/repo' }).ok, false);
assert.equal(validateRDTIQualification({ ...base, repository_url: '' }).ok, true);
console.log('RDTI_QUALIFICATION_REGRESSION=PASS');
console.log('CONSENT_GATE=PASS');
console.log('REPOSITORY_AUTHORITY_GATE=PASS');
console.log('NO_AUTOMATIC_PAYMENT_OR_CONTACT=PASS');
