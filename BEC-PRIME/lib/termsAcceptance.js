'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const TERMS_VERSION = '2026-10-30-review-v1';
const TERMS_PATH = path.resolve(__dirname, '..', 'compiled', 'website', 'terms.html');

function currentTerms() {
  const bytes = fs.readFileSync(TERMS_PATH);
  return {
    version: TERMS_VERSION,
    sha256: crypto.createHash('sha256').update(bytes).digest('hex')
  };
}

function verifyAcceptance(input, terms = currentTerms()) {
  const a = input && input.terms_acceptance;
  if (!a || a.accepted !== true || a.version !== terms.version || a.sha256 !== terms.sha256) {
    return { ok: false, reason: 'CURRENT_TERMS_ACCEPTANCE_REQUIRED' };
  }
  return {
    ok: true,
    record: {
      version: terms.version,
      sha256: terms.sha256,
      accepted_at: new Date().toISOString(),
      method: 'explicit_checkbox'
    }
  };
}

module.exports = { currentTerms, verifyAcceptance };
