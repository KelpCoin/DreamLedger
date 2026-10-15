'use strict';
import crypto from 'node:crypto';

export const VERDICTS = ['VERIFIED_MATCH', 'MISMATCH', 'INSUFFICIENT_EVIDENCE', 'UNAVAILABLE'];
export const DEFAULT_ROLES = [
  { role: 'EXTRACTOR', model: 'scout', promptVersion: 'extractor.v1' },
  { role: 'GAUNTLET', model: 'critic', promptVersion: 'gauntlet.v1' },
  { role: 'ELOHIM', model: 'vision', promptVersion: 'elohim.v1' }
];

export function canonicalJson(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Non-finite number');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (typeof value === 'object') return '{' + Object.keys(value).sort().map((k) => {
    if (value[k] === undefined) throw new TypeError('Undefined value: ' + k);
    return JSON.stringify(k) + ':' + canonicalJson(value[k]);
  }).join(',') + '}';
  throw new TypeError('Unsupported canonical value');
}
export const sha256 = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');

export function validateVerdict(x, role) {
  if (!x || x.schema_version !== 'dreamledger.tri-llm-verdict/v1') return false;
  if (!VERDICTS.includes(x.verdict) || typeof x.rationale !== 'string' || !x.rationale.trim()) return false;
  if (!Array.isArray(x.evidence_refs) || !x.evidence_refs.every(v => typeof v === 'string')) return false;
  if (!Array.isArray(x.limitations) || !x.limitations.every(v => typeof v === 'string')) return false;
  if (role === 'EXTRACTOR' && (!Array.isArray(x.facts) || !x.facts.every(v => v && typeof v.name === 'string' && typeof v.value === 'string'))) return false;
  return true;
}
export function validateLocalEndpoint(raw) {
  const url = new URL(raw);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]', '::1'].includes(url.hostname)) throw new Error('LOCAL_ENDPOINT_REQUIRED');
  return url;
}

function makePrompt(role, ctx) {
  return [
    'Return JSON only, no Markdown.',
    'Required: schema_version="dreamledger.tri-llm-verdict/v1", verdict, rationale, evidence_refs string array, limitations string array.',
    'Allowed verdicts: VERIFIED_MATCH, MISMATCH, INSUFFICIENT_EVIDENCE, UNAVAILABLE.',
    'Never invent evidence, payment state, buyers, or fulfillment. A model verdict is not proof.',
    'Use INSUFFICIENT_EVIDENCE when the retained context does not support a conclusion.',
    'Role=' + role + '; input_sha256=' + ctx.inputDigest + '; context_version=' + ctx.contextVersion + '; policy_version=' + ctx.policyVersion + '; prompt_version=' + ctx.promptVersion,
    role === 'EXTRACTOR' ? 'Also include facts: [{name:string,value:string}], extracted only from input.' : 'Also include findings: string array and independently challenge prior stages.'
  ].join('\n');
}
async function callModel({ endpoint, token, model, role, prompt, context, fetchImpl, timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = { 'content-type': 'application/json' };
    if (token) headers.authorization = 'Bearer ' + token;
    const response = await fetchImpl(endpoint, { method: 'POST', headers, signal: controller.signal,
      body: JSON.stringify({ model, temperature: 0, stream: false, messages: [
        { role: 'system', content: prompt }, { role: 'user', content: canonicalJson(context) }
      ] }) });
    if (!response.ok) throw new Error('MODEL_UNAVAILABLE:' + role + ':' + response.status);
    const raw = await response.text();
    if (Buffer.byteLength(raw, 'utf8') > 131072) throw new Error('MODEL_RESPONSE_TOO_LARGE:' + role);
    const envelope = JSON.parse(raw);
    const text = envelope?.choices?.[0]?.message?.content;
    if (typeof text !== 'string') throw new Error('MODEL_RESPONSE_SHAPE_INVALID:' + role);
    const output = JSON.parse(text);
    if (!validateVerdict(output, role)) throw new Error('MODEL_SCHEMA_INVALID:' + role);
    return { role, model, promptVersion: context.promptVersion, output };
  } finally { clearTimeout(timer); }
}
