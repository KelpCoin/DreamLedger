'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { currentTerms, verifyAcceptance } = require('../lib/termsAcceptance');

const meta = currentTerms();
assert.match(meta.sha256, /^[a-f0-9]{64}$/);
assert.equal(verifyAcceptance({}).ok, false);
assert.equal(verifyAcceptance({ terms_acceptance: { accepted: false, version: meta.version, sha256: meta.sha256 } }).ok, false);
assert.equal(verifyAcceptance({ terms_acceptance: { accepted: true, version: meta.version, sha256: '0'.repeat(64) } }).ok, false);
const accepted = verifyAcceptance({ terms_acceptance: { accepted: true, version: meta.version, sha256: meta.sha256 } });
assert.equal(accepted.ok, true);
assert.equal(accepted.record.method, 'explicit_checkbox');
assert.equal(accepted.record.sha256, meta.sha256);

const runtimeTerms = fs.readFileSync(path.join(__dirname,'..','compiled','website','terms.html'),'utf8');
const sourceTerms = fs.readFileSync(path.join(__dirname,'..','..','public','terms.html'),'utf8');
assert.equal(runtimeTerms,sourceTerms,'Canonical runtime terms and public source must match');
assert.ok(!runtimeTerms.includes('conclusive evidence'));
assert.ok(!runtimeTerms.includes('$25,000'));
assert.ok(!runtimeTerms.includes('$1,000/day'));
assert.ok(runtimeTerms.includes('statutory computer-program exceptions'));
console.log('PASS: draft terms snapshot, explicit checkbox verification and legal wording constraints');
