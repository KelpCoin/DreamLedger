'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const LocalLMStudioAdapter = require('./LocalLMStudioAdapter');

function response(data, status = 200) {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(data) };
}

test('local adapter accepts only loopback LM Studio endpoints', () => {
  assert.throws(
    () => new LocalLMStudioAdapter({ baseUrl: 'https://example.com/v1' }),
    /LOCAL_LMSTUDIO_ENDPOINT_MUST_BE_LOOPBACK/
  );
  assert.doesNotThrow(() => new LocalLMStudioAdapter({ baseUrl: 'http://127.0.0.1:1234/v1' }));
});

test('health reports only models actually returned by the local API', async () => {
  const adapter = new LocalLMStudioAdapter({ baseUrl: 'http://127.0.0.1:1234/v1', timeoutMs: 1000 });
  const models = await adapter.health(async () => response({ data: [{ id: 'qwen2.5-7b-instruct' }] }));
  assert.deepEqual(models, [{ id: 'qwen2.5-7b-instruct' }]);
});

test('health returns an empty list when the API reports no models, never inventing a model', async () => {
  const adapter = new LocalLMStudioAdapter({ baseUrl: 'http://localhost:1234/v1', timeoutMs: 1000 });
  const models = await adapter.health(async () => response({ data: [] }));
  assert.deepEqual(models, []);
});
