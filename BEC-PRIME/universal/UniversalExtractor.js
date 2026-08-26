'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const CONFIG = path.join(__dirname, 'config', 'sources.json');
const TELEMETRY_DIR = process.env.UNIVERSAL_TELEMETRY_DIR || path.join(ROOT, 'data', 'universal');
const TELEMETRY_FILE = path.join(TELEMETRY_DIR, 'extraction-telemetry.jsonl');

function loadConfig() {
  return JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
}

function sourceAllowed(sourceId) {
  const source = loadConfig().sources.find(s => s.id === sourceId);
  return Boolean(source && source.enabled && source.policy !== 'blocked');
}

function ensureTelemetry() {
  fs.mkdirSync(TELEMETRY_DIR, { recursive: true });
}

function recordTelemetry(event) {
  ensureTelemetry();
  fs.appendFileSync(TELEMETRY_FILE, JSON.stringify({
    event_id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...event
  }) + '\n', 'utf8');
}

function requestJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    let parsed;
    try { parsed = new URL(url); } catch { return reject(new Error('Invalid URL')); }
    if (parsed.protocol !== 'https:') return reject(new Error('Only HTTPS is allowed for remote extraction'));

    const req = https.request(url, {
      method: options.method || 'GET',
      headers: { 'User-Agent': 'DreamLedger-UniversalExtractor/1.0', Accept: 'application/json', ...(options.headers || {}) },
      timeout: Number(options.timeout || 15000)
    }, res => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => {
        data += chunk;
        if (data.length > 4000000) req.destroy(new Error('Response too large'));
      });
      res.on('end', () => {
        const duration_ms = Date.now() - started;
        if (res.statusCode < 200 || res.statusCode >= 300) {
          recordTelemetry({ type: 'request', source: options.sourceId || 'http_json', status: 'ERROR', status_code: res.statusCode, duration_ms });
          return reject(new Error('HTTP ' + res.statusCode));
        }
        try {
          const value = JSON.parse(data);
          recordTelemetry({ type: 'request', source: options.sourceId || 'http_json', status: 'OK', status_code: res.statusCode, duration_ms, result_count: Array.isArray(value) ? value.length : (Array.isArray(value.items) ? value.items.length : null) });
          resolve(value);
        } catch {
          recordTelemetry({ type: 'request', source: options.sourceId || 'http_json', status: 'INVALID_JSON', status_code: res.statusCode, duration_ms });
          reject(new Error('Invalid JSON response'));
        }
      });
    });
    req.on('error', error => {
      recordTelemetry({ type: 'request', source: options.sourceId || 'http_json', status: 'ERROR', error: error.message, duration_ms: Date.now() - started });
      reject(error);
    });
    req.on('timeout', () => req.destroy(new Error('Request timeout')));
    req.end();
  });
}

function readLocalJson(filePath) {
  const resolved = path.resolve(filePath);
  const root = path.resolve(process.env.UNIVERSAL_LOCAL_ROOT || path.join(ROOT, 'data'));
  if (!(resolved === root || resolved.startsWith(root + path.sep))) throw new Error('Local file is outside UNIVERSAL_LOCAL_ROOT');
  const value = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  recordTelemetry({ type: 'local_read', source: 'local_file', status: 'OK', path: resolved });
  return value;
}

function patternMatch(text, patterns) {
  const input = String(text || '');
  const output = {};
  for (const [field, pattern] of Object.entries(patterns || {})) {
    const re = pattern instanceof RegExp ? pattern : new RegExp(String(pattern), 'giu');
    output[field] = [...input.matchAll(re)].map(m => m[0]).slice(0, 100);
  }
  recordTelemetry({ type: 'pattern_match', status: 'OK', fields: Object.keys(output), match_counts: Object.fromEntries(Object.entries(output).map(([k, v]) => [k, v.length])) });
  return output;
}

function normalizeCandidate(raw, sourceId) {
  const value = raw || {};
  return {
    schema: 'candidate-item-v1',
    platform: sourceId,
    product_id: value.product_id || value.productId || value.id || null,
    title: value.title || null,
    price: value.price == null ? null : Number(value.price),
    currency: value.currency || null,
    product_url: value.product_url || value.url || null,
    image_url: value.image_url || value.image || null,
    seller: value.seller || null,
    condition: value.condition || null,
    shipping: value.shipping == null ? null : Number(value.shipping),
    extracted_at: new Date().toISOString()
  };
}

module.exports = {
  CONFIG,
  TELEMETRY_FILE,
  loadConfig,
  sourceAllowed,
  requestJson,
  readLocalJson,
  patternMatch,
  normalizeCandidate,
  recordTelemetry
};
