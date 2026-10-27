'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const analyze = require('../handlers/analyze.js');
function call(method, body) {
  const headers = {};
  let raw = '';
  const res = { statusCode: 200, setHeader(k, v) { headers[k] = v; }, end(v) { raw = v; } };
  analyze({ method, body }, res);
  return { status: res.statusCode, headers, body: JSON.parse(raw) };
}
test('GET is an honest free prototype, never a subscription promise', () => {
  const r = call('GET');
  assert.equal(r.status, 200);
  assert.equal(r.body.paid_access_enabled, false);
  assert.equal(r.body.independent_source_verification, false);
});
test('POST provides stable SHA-256 receipts when sources change order', () => {
  const claim = 'A lead time is two weeks';
  const a = { url: 'https://example.org/a', excerpt: '14 days', observed_at: '2026-10-27' };
  const b = { url: 'https://example.org/b', excerpt: 'Delivery estimate', observed_at: '2026-10-27' };
  const r1 = call('POST', { claim, sources: [a, b] });
  const r2 = call('POST', { claim, sources: [b, a] });
  assert.equal(r1.status, 200);
  assert.equal(r1.body.receipt.hash, r2.body.receipt.hash);
  assert.match(r1.body.receipt.hash, /^[a-f0-9]{64}$/);
  assert.equal(r1.body.verdict, 'NOT_VERIFIED');
  assert.equal(r1.body.paid_access_enabled, false);
});
test('duplicate URLs do not count as independent evidence', () => {
  const r = call('POST', { claim: 'Claim', sources: [{ url: 'https://a.example/x' }, { url: 'https://a.example/x' }] });
  assert.equal(r.status, 200);
  assert.equal(r.body.source_count, 1);
});
test('receipt changes when a claim changes', () => {
  const r1 = call('POST', { claim: 'A', sources: [] });
  const r2 = call('POST', { claim: 'B', sources: [] });
  assert.notEqual(r1.body.receipt.hash, r2.body.receipt.hash);
  assert.ok(r1.body.gaps.includes('NO_SOURCES_PROVIDED'));
});
test('rejects missing claim, invalid schemes, oversized and excess sources', () => {
  assert.equal(call('POST', { sources: [] }).status, 422);
  assert.equal(call('POST', { claim: 'x', sources: [{ url: 'file:///etc/passwd' }] }).status, 422);
  assert.equal(call('POST', { claim: 'x'.repeat(9000), sources: [] }).status, 413);
  assert.equal(call('POST', { claim: 'x', sources: Array.from({length: 11}, (_, i) => ({url: 'https://a.example/'+i})) }).status, 422);
  assert.equal(call('POST', { claim: 'x', sources: [{ url: 'https://alice:secret@example.org' }] }).status, 422);
});
test('method not allowed', () => {
  const r = call('DELETE');
  assert.equal(r.status, 405);
  assert.equal(r.headers.Allow, 'GET, POST');
});
