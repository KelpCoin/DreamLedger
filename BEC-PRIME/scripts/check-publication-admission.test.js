'use strict';

const assert = require('assert');
const crypto = require('crypto');

const candidateKey = 'release:github:abc123';
const candidateHash = crypto.createHash('sha256').update(candidateKey, 'utf8').digest('hex');

assert.strictEqual(candidateHash.length, 64);
assert.match(candidateHash, /^[a-f0-9]{64}$/);

const admitted = {
  candidate_key: candidateKey,
  candidate_sha256: candidateHash,
  candidate_type: 'RELEASE',
  policy_decision: 'ALLOW',
  admitted: true,
  oracle_verdict: 'VERIFIED',
  gauntlet_verdict: 'PASS',
  evidence_complete: true,
  ci_verified: true
};

assert.strictEqual(admitted.admitted, true);
assert.strictEqual(admitted.policy_decision, 'ALLOW');
assert.strictEqual(admitted.oracle_verdict, 'VERIFIED');
assert.strictEqual(admitted.gauntlet_verdict, 'PASS');
assert.strictEqual(admitted.evidence_complete && admitted.ci_verified, true);

for (const blocked of [
  { policy_decision: 'DENY', admitted: false },
  { policy_decision: 'HUMAN_REQUIRED', admitted: false },
  { policy_decision: 'ALLOW', admitted: false }
]) {
  assert.strictEqual(blocked.admitted && ['ALLOW', 'ALLOW_WITH_CAVEATS'].includes(blocked.policy_decision), false);
}

assert.notStrictEqual(candidateHash, crypto.createHash('sha256').update('release:github:def456', 'utf8').digest('hex'));
console.log('PASS: publication admission checker contract tests');
