import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalJson, sha256, validateVerdict, validateLocalEndpoint, runTriLlm, DEFAULT_ROLES } from './tri-llm-worker.mjs';

const output = (role, verdict = 'VERIFIED_MATCH') => ({
  schema_version: 'dreamledger.tri-llm-verdict/v1',
  verdict,
  rationale: 'Supported only by supplied test fixture.',
  evidence_refs: ['fixture:quote-1'],
  limitations: ['Fixture does not establish real-world truth.'],
  ...(role === 'EXTRACTOR' ? { facts: [{ name: 'total', value: '12.00' }] } : { findings: ['Fixture check'] })
});
const mockFetch = (verdicts = ['VERIFIED_MATCH','VERIFIED_MATCH','VERIFIED_MATCH']) => {
  let index = 0;
  return async (_url, init) => {
    assert.equal(init.method, 'POST');
    const body = JSON.parse(init.body);
    const role = DEFAULT_ROLES[index].role;
    assert.equal(body.model, DEFAULT_ROLES[index].model);
    const content = JSON.stringify(output(role, verdicts[index++]));
    return { ok: true, status: 200, text: async () => JSON.stringify({ choices: [{ message: { content } }] }) };
  };
};

test('canonical JSON sorts object keys and hashes reproducibly', () => {
  assert.equal(canonicalJson({ z: 1, a: 2 }), '{"a":2,"z":1}');
  assert.equal(sha256(canonicalJson({ a: 2, z: 1 })), sha256(canonicalJson({ z: 1, a: 2 })));
});
test('public or network LM endpoints are rejected', () => {
  assert.throws(() => validateLocalEndpoint('http://0.0.0.0:1235/v1/chat/completions'), /LOCAL_ENDPOINT_REQUIRED/);
  assert.throws(() => validateLocalEndpoint('https://example.com/v1/chat/completions'), /LOCAL_ENDPOINT_REQUIRED/);
  assert.equal(validateLocalEndpoint('http://127.0.0.1:1235/v1/chat/completions').port, '1235');
});
test('verdict schema requires an explicit permitted verdict', () => {
  assert.equal(validateVerdict(output('EXTRACTOR'), 'EXTRACTOR'), true);
  assert.equal(validateVerdict({ ...output('GAUNTLET'), verdict: 'PASS' }, 'GAUNTLET'), false);
  assert.equal(validateVerdict({ ...output('EXTRACTOR'), facts: null }, 'EXTRACTOR'), false);
});
test('unanimous explicit model assessment yields review-required, never automatic verification', async () => {
  const result = await runTriLlm({
    input: { quoteId: 'fixture-1', total: '12.00' },
    fetchImpl: mockFetch(),
    token: 'test-token',
    now: () => '2026-10-15T00:00:00.000Z'
  });
  assert.equal(result.status, 'REVIEW_REQUIRED');
  assert.equal(result.verdict, 'VERIFIED_MATCH');
  assert.equal(result.modelResults.length, 3);
  assert.match(result.receipt.receiptSha256, /^[a-f0-9]{64}$/);
  assert.match(result.inputDigest, /^[a-f0-9]{64}$/);
});
test('disagreement fails closed', async () => {
  const result = await runTriLlm({
    input: { quoteId: 'fixture-2' },
    fetchImpl: mockFetch(['VERIFIED_MATCH', 'MISMATCH', 'VERIFIED_MATCH'])
  });
  assert.equal(result.status, 'QUARANTINE');
  assert.equal(result.verdict, 'INSUFFICIENT_EVIDENCE');
});
test('unavailable model returns no receipt and no successful verdict', async () => {
  const result = await runTriLlm({ input: { quoteId: 'fixture-3' }, fetchImpl: async () => { throw new Error('offline'); } });
  assert.equal(result.status, 'UNAVAILABLE');
  assert.equal(result.verdict, 'UNAVAILABLE');
  assert.equal(result.receipt, null);
});
test('duplicate model aliases are rejected instead of silently duplicated', async () => {
  const result = await runTriLlm({
    input: { quoteId: 'fixture-4' },
    roles: DEFAULT_ROLES.map(x => ({ ...x, model: 'scout' })),
    fetchImpl: mockFetch()
  });
  assert.equal(result.status, 'QUARANTINE');
  assert.equal(result.reason, 'THREE_DISTINCT_MODELS_REQUIRED');
});
