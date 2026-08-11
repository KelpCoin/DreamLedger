'use strict';

const crypto = require('crypto');

const DEFAULT_BASE_URL = 'http://localhost:1234/v1';

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function sha256(value) { return crypto.createHash('sha256').update(value, 'utf8').digest('hex'); }
function normaliseBaseUrl(value) { return String(value || DEFAULT_BASE_URL).replace(/\/+$/, ''); }

class KelplantisAdapter {
  constructor(options = {}) {
    this.baseUrl = normaliseBaseUrl(options.baseUrl || process.env.LMSTUDIO_BASE_URL);
    this.apiKey = options.apiKey || process.env.LMSTUDIO_API_KEY || 'lm-studio';
    this.timeoutMs = Number(options.timeoutMs || process.env.KELPLANTIS_TIMEOUT_MS || 45000);
    this.retries = Number(options.retries ?? process.env.KELPLANTIS_RETRIES ?? 2);
  }

  async request(path, init = {}) {
    let lastError;
    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await fetch(`${this.baseUrl}${path}`, {
          ...init,
          signal: controller.signal,
          headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json', ...(init.headers || {}) }
        });
        const text = await response.text();
        let body;
        try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
        if (!response.ok) throw new Error(`LM Studio HTTP ${response.status}: ${body?.error?.message || text}`);
        return body;
      } catch (error) {
        lastError = error;
        if (attempt < this.retries) await sleep(250 * (attempt + 1));
      } finally { clearTimeout(timer); }
    }
    throw lastError;
  }

  async listModels() {
    const result = await this.request('/models', { method: 'GET' });
    return Array.isArray(result.data) ? result.data : [];
  }

  async health() {
    const started = Date.now();
    try {
      const models = await this.listModels();
      return { status: 'ok', base_url: this.baseUrl, model_count: models.length, models: models.map(m => m.id), latency_ms: Date.now() - started };
    } catch (error) {
      return { status: 'external_blocked', base_url: this.baseUrl, error: error.message, latency_ms: Date.now() - started };
    }
  }

  async structuredChat({ model, messages, schema, schemaName, tools = [], toolExecutor = null, temperature = 0, maxTokens = 1200, maxToolRounds = 2 }) {
    let workingMessages = [...messages];
    const toolCalls = [];
    for (let round = 0; round <= maxToolRounds; round += 1) {
      const payload = { model, messages: workingMessages, temperature, max_tokens: maxTokens, stream: false };
      if (round === maxToolRounds || !tools.length) {
        payload.response_format = { type: 'json_schema', json_schema: { name: schemaName, strict: true, schema } };
      } else {
        payload.tools = tools;
        payload.tool_choice = 'auto';
      }
      const response = await this.request('/chat/completions', { method: 'POST', body: JSON.stringify(payload) });
      const message = response?.choices?.[0]?.message;
      if (!message) throw new Error(`Model ${model} returned no message`);
      if (message.tool_calls?.length && toolExecutor && round < maxToolRounds) {
        workingMessages.push({ role: 'assistant', tool_calls: message.tool_calls });
        for (const call of message.tool_calls) {
          const name = call.function?.name;
          let args = {};
          try { args = JSON.parse(call.function?.arguments || '{}'); } catch { throw new Error(`Invalid arguments for tool ${name}`); }
          const result = await toolExecutor(name, args);
          toolCalls.push({ id: call.id, name, arguments: args, result });
          workingMessages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
        }
        continue;
      }
      if (!message.content) throw new Error(`Model ${model} returned no structured content`);
      let parsed;
      try { parsed = JSON.parse(message.content); } catch { throw new Error(`Model ${model} returned invalid JSON`); }
      return { model, result: parsed, tool_calls: toolCalls, response_id: response.id || null, content_sha256: sha256(message.content) };
    }
    throw new Error(`Model ${model} exceeded tool rounds`);
  }
}

module.exports = { KelplantisAdapter, DEFAULT_BASE_URL, sha256 };
