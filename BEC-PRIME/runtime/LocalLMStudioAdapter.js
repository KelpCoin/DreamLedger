'use strict';

/*
 * Local LM Studio adapter.
 * Local-only by construction. Endpoint is configurable and loopback-only.
 * /v1/models is the authority for models currently exposed by the server.
 * It never decides truth, payment, fulfillment, or public-release state.
 */

class LocalLMStudioAdapter {
  constructor(options = {}) {
    this.baseUrl = String(options.baseUrl || process.env.LM_STUDIO_BASE_URL || process.env.LMSTUDIO_BASE_URL || 'http://127.0.0.1:1234/v1').replace(/\/$/, '');
    this.model = String(options.model || process.env.LM_STUDIO_MODEL || process.env.LMSTUDIO_MODEL || '').trim();
    this.timeoutMs = Number(options.timeoutMs || 180000);
    if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/v1$/.test(this.baseUrl)) {
      throw new Error('LOCAL_LMSTUDIO_ENDPOINT_MUST_BE_LOOPBACK');
    }
  }

  async health(fetchImpl = globalThis.fetch) {
    const r = await fetchImpl(this.baseUrl + '/models', {
      method: 'GET',
      signal: AbortSignal.timeout(this.timeoutMs)
    });
    const text = await r.text();
    if (!r.ok) throw new Error('LM_STUDIO_MODELS_' + r.status + ': ' + text.slice(0, 1000));
    const data = JSON.parse(text || '{}');
    return Array.isArray(data.data) ? data.data : [];
  }

  async discoverModel(fetchImpl = globalThis.fetch) {
    const models = await this.health(fetchImpl);
    if (!models.length) throw new Error('LM_STUDIO_NO_MODELS_EXPOSED');
    if (this.model) {
      const found = models.find(item => String(item.id) === this.model);
      if (!found) throw new Error('LM_STUDIO_MODEL_NOT_EXPOSED:' + this.model);
      return found.id;
    }
    return String(models[0].id);
  }

  async execute(input, fetchImpl = globalThis.fetch) {
    if (!input || typeof input !== 'object') throw new Error('LOCAL_LMSTUDIO_INPUT_REQUIRED');
    const model = await this.discoverModel(fetchImpl);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const body = {
        model,
        messages: [
          { role: 'system', content: String(input.system || 'You are a bounded local worker. Never invent evidence.') },
          { role: 'user', content: typeof input.prompt === 'string' ? input.prompt : JSON.stringify(input.payload || input) }
        ],
        temperature: Number.isFinite(Number(input.temperature)) ? Number(input.temperature) : 0.1,
        max_tokens: Number.isFinite(Number(input.maxTokens)) ? Number(input.maxTokens) : 2048,
        stream: false
      };
      const r = await fetchImpl(this.baseUrl + '/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      const text = await r.text();
      if (!r.ok) throw new Error('LM_STUDIO_' + r.status + ': ' + text.slice(0, 2000));
      const data = JSON.parse(text || '{}');
      const content = data && data.choices && data.choices[0] && data.choices[0].message
        ? data.choices[0].message.content
        : null;
      if (typeof content !== 'string' || !content.trim()) throw new Error('LOCAL_LMSTUDIO_EMPTY_RESPONSE');
      return {
        ok: true,
        provider: 'lmstudio-local',
        model,
        content,
        usage: data.usage || null,
        finish_reason: data.choices[0].finish_reason || null
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

module.exports = LocalLMStudioAdapter;
