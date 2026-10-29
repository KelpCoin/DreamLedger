'use strict';
const { createHmac, timingSafeEqual } = require('node:crypto');

function verifyStripeSignature(bytes, header, secret, nowMs = Date.now()) {
  if (!Buffer.isBuffer(bytes) || !secret || typeof secret !== 'string' || secret.length < 16 ||
      !header || typeof header !== 'string' || header.length > 8192) return false;
  const pieces = header.split(',').map(x => x.trim());
  const times = pieces.filter(x => /^t=\d{9,12}$/.test(x));
  const signatures = pieces.filter(x => /^v1=[a-f0-9]{64}$/i.test(x));
  if (times.length !== 1 || signatures.length < 1) return false;
  const ts = Number(times[0].slice(2));
  if (!Number.isSafeInteger(ts) || Math.abs(nowMs / 1000 - ts) > 300) return false;
  const expected = createHmac('sha256', secret)
    .update(String(ts)).update('.').update(bytes).digest();
  return signatures.some(v => {
    const actual = Buffer.from(v.slice(3), 'hex');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  });
}
module.exports = {verifyStripeSignature};
