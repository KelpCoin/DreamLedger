'use strict';

/*
 * Local LM Studio adapter.
 * Same high-level execute(input) contract as cloud model adapters.
 * Local-only by construction: endpoint must resolve to loopback.
 * It never decides truth, payment, fulfillment, or public-release state.
 */

class LocalLMStudioAdapter {
  constructor(options = {}) {
    this.baseUrl = String(options.baseUrl || process.env.LM_STUDIO_BASE_URL || process.env.LMSTUDIO_BASE_URL || 'http://127.0.0.1:1234/v1').replace(/\/$/, '');
    this.model = String(options.model || process.env.LM_STUDIO_MODEL || process.env.LMSTUDIO_MODEL || '').trim();
    this.gpuMode = String(options.gpuMode || process.env.LM_STUDIO_GPU || 'max').trim();
    this.timeoutMs = Number(options.timeoutMs || 180000);
    if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/v1$/.test(this.baseUrl)) {
      throw new Error('LOCAL_LMSTUDIO_ENDPOINT_MUST_BE_LOOPBACK');
    }
  }

  async health(fetchImpl = globalThis.fetch) {
    try {
      const r0 = await fetchImpl(this.baseUrl + '/models', { method: 'GET', signal: AbortSignal.timeout(this.timeoutMs) });
      if (!r0.ok) throw new Error('HTTP_' + r0.status);
    } catch (_) {
      const cli = process.platform === 'win32' ? 'lms.exe' : 'lms';
      const run = (args) => require('node:child_process').spawnSync(cli, args, { encoding: 'utf8', windowsHide: true, timeout: 15000 });
      const daemon = run(['daemon', 'up']);
      const server = run(['server', 'start']);
      if (daemon.error && server.error) throw new Error('LLMSTER_UNAVAILABLE:' + daemon.error.message);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    const r = await fetchImpl(this.baseUrl + '/models', { method: 'GET', signal: AbortSignal.timeout(this.timeoutMs) });
    const text = await r.text();
    if (!r.ok) throw new Error('LM_STUDIO_MODELS_' + r.status + ': ' + text.slice(0, 1000));
    const data = JSON.parse(text || '{}');
    return Array.isArray(data.data) ? data.data : [];
  }

  async ensureReady(fetchImpl = globalThis.fetch) {
    const models = await this.health(fetchImpl);
    if (!models.length) return { status: 'SERVER_READY', model: null, gpuStatus: 'UNOBSERVABLE', models: [] };
    const selected = this.model ? models.find(item => String(item.id) === this.model) : models[0];
    if (!selected) throw new Error('MODEL_NOT_DISCOVERED:' + this.model);
    this.model = String(selected.id);
    const cli = process.platform === 'win32' ? 'lms.exe' : 'lms';
    const ps = require('node:child_process').spawnSync(cli, ['ps', '--json'], { encoding: 'utf8', windowsHide: true, timeout: 15000 });
    let loaded = [];
    try { loaded = JSON.parse(String(ps.stdout || '')); } catch (_) { loaded = []; }
    const isLoaded = Array.isArray(loaded) && loaded.some(item =>
      String(item.identifier || item.id || item.model || '').trim() === this.model ||
      String(item.modelKey || item.path || '').trim() === this.model
    );
    if (!isLoaded) {
      const load = require('node:child_process').spawnSync(cli, ['load', this.model, '--gpu', this.gpuMode], { encoding: 'utf8', windowsHide: true, timeout: 120000 });
      if (load.status !== 0) throw new Error('MODEL_LOAD_FAILED:' + String(load.stderr || load.stdout || '').slice(0, 1000));
      const verify = require('node:child_process').spawnSync(cli, ['ps', '--json'], { encoding: 'utf8', windowsHide: true, timeout: 15000 });
      try { loaded = JSON.parse(String(verify.stdout || '')); } catch (_) { loaded = []; }
      const loadedAfter = Array.isArray(loaded) && loaded.some(item =>
        String(item.identifier || item.id || item.model || '').trim() === this.model ||
        String(item.modelKey || item.path || '').trim() === this.model
      );
      if (!loadedAfter) throw new Error('MODEL_LOAD_NOT_VISIBLE_IN_LMS_PS');
    }
    return { status: 'MODEL_LOADED', model: this.model, gpuStatus: 'UNOBSERVABLE', models };
  }

  async execute(input, fetchImpl = globalThis.fetch) {
    if (!input || typeof input !== 'object') throw new Error('LOCAL_LMSTUDIO_INPUT_REQUIRED');
    const ready = await this.ensureReady(fetchImpl);
    if (!ready.model) throw new Error('LOCAL_LMSTUDIO_NO_MODEL');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const body = {
        model: ready.model,
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
        model: ready.model,
        content,
        usage: data.usage || null,
        finish_reason: data.choices[0].finish_reason || null,
        status: 'READY_INFERENCE',
        gpu_status: 'UNOBSERVABLE'
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

module.exports = LocalLMStudioAdapter;
