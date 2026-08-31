'use strict';
const assert = require('assert');
const policy = require('../lib/siloFeePolicy');
const expected = { 'dreamledger-mtg': 0, amplissa: 500, 'bbw-ssbbw-creator': 500, unrelated: 500 };
for (const [silo, bps] of Object.entries(expected)) {
  const resolved = policy.resolve(silo);
  assert.strictEqual(resolved.platform_fee_bps, bps, silo + ' fee mismatch');
  assert.strictEqual(policy.assert(silo, bps).platform_fee_bps, bps, silo + ' assertion failed');
  assert.throws(() => policy.assert(silo, bps === 0 ? 500 : 0), /SILO_FEE_POLICY_VIOLATION/);
}
assert.strictEqual(policy.resolve('MTG').platform_fee_bps, 0);
assert.strictEqual(policy.resolve('AMPLISSA').platform_fee_bps, 500);
console.log('PASS: BECK silo fee policy verified.');
console.log('MTG=0 bps; AMPLISSA=500 bps; BBW_SSBBW=500 bps; default=500 bps.');
console.log('Policy SHA256: ' + policy.policySha256());
