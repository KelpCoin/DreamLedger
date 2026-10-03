'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const LocalLMStudioAdapter = require('./LocalLMStudioAdapter');

test('discovers the actual model from /v1/models instead of assuming local', async () => {
  const adapter = new LocalLMStudioAdapter({ baseUrl: 'http://127.0.0.1:1235/v1' });
  const fetchImpl = async (url, options) => {
    assert.equal(url, 'http://127.0.0.1:1235/v1/models');
    return { ok: true, text: async () => JSON.stringify({ data: [{ id: 'actual/model-q4' }] }) };
  };
  assert.equal(await adapter.discoverModel(fetchImpl), 'actual/model-q4');
});

test('configured model must actually be exposed by /v1/models', async () => {
  const adapter = new LocalLMStudioAdapter({ baseUrl: 'http://127.0.0.1:1235/v1', model: 'missing' });
  const fetchImpl = async () => ({ ok: true, text: async () => JSON.stringify({ data: [{ id: 'present' }] }) });
  await assert.rejects(() => adapter.discoverModel(fetchImpl), /LM_STUDIO_MODEL_NOT_EXPOSED:missing/);
});
