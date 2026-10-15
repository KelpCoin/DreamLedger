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
  if (role !== 'EXTRACTOR' && (!Array.isArray(x.findings) || !x.findings.every(v => typeof v === 'string'))) return false;
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
async function callModel({ endpoint, token, model, role, prompt, promptVersion, context, fetchImpl, timeoutMs }) {
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
    if (Buffer.byteLength(raw, 'utf8') > 32768) throw new Error('MODEL_RESPONSE_TOO_LARGE:' + role);
    const envelope = JSON.parse(raw);
    const text = envelope?.choices?.[0]?.message?.content;
    if (typeof text !== 'string') throw new Error('MODEL_RESPONSE_SHAPE_INVALID:' + role);
    const output = JSON.parse(text);
    if (!validateVerdict(output, role)) throw new Error('MODEL_SCHEMA_INVALID:' + role);
    return { role, model, promptVersion, output };
  } finally { clearTimeout(timer); }
}

export async function runTriLlm({
  input, endpoint = 'http://127.0.0.1:1235/v1/chat/completions',
  token = process.env.LM_API_TOKEN || '', contextVersion = 'context.v1',
  policyVersion = 'policy.v1', roles = DEFAULT_ROLES, fetchImpl = globalThis.fetch,
  timeoutMs = 25000, now = () => new Date().toISOString()
}) {
  const checkedAt = now();
  let inputJson, inputDigest;
  try {
    inputJson = canonicalJson(input);
    if (Buffer.byteLength(inputJson, 'utf8') > 65536) throw new Error('INPUT_TOO_LARGE');
    inputDigest = sha256(inputJson);
  } catch (e) {
    return { status: 'QUARANTINE', verdict: 'INSUFFICIENT_EVIDENCE', reason: String(e.message || e), inputDigest: null, receipt: null };
  }
  let url;
  try { url = validateLocalEndpoint(endpoint); } catch (e) {
    return { status: 'UNAVAILABLE', verdict: 'UNAVAILABLE', reason: String(e.message || e), inputDigest, receipt: null };
  }
  if (!Array.isArray(roles) || roles.length !== 3 ||
      new Set(roles.map(x => x.role)).size !== 3 || new Set(roles.map(x => x.model)).size !== 3 ||
      !roles.every(x => ['EXTRACTOR', 'GAUNTLET', 'ELOHIM'].includes(x.role) && x.model && x.promptVersion)) {
    return { status: 'QUARANTINE', verdict: 'INSUFFICIENT_EVIDENCE', reason: 'THREE_DISTINCT_MODELS_REQUIRED', inputDigest, receipt: null };
  }
  const results = [];
  for (const r of roles) {
    try {
      const context = { input: JSON.parse(inputJson), priorStages: results.map(x => ({ role: x.role, model: x.model, output: x.output })) };
      const ctx = { inputDigest, contextVersion, policyVersion, promptVersion: r.promptVersion };
      const result = await callModel({ endpoint: url.toString(), token, model: r.model, role: r.role,
        prompt: makePrompt(r.role, ctx), promptVersion: r.promptVersion, context, fetchImpl, timeoutMs });
      results.push(result);
    } catch (e) {
      return { status: 'UNAVAILABLE', verdict: 'UNAVAILABLE', reason: String(e.message || e), inputDigest, modelResults: results, receipt: null };
    }
  }
  const verdicts = results.map(x => x.output.verdict);
  const consensus = verdicts.every(v => v === verdicts[0]);
  const verdict = consensus ? verdicts[0] : 'INSUFFICIENT_EVIDENCE';
  const status = consensus && verdict === 'VERIFIED_MATCH' ? 'REVIEW_REQUIRED' : 'QUARANTINE';
  const receiptBody = {
    schema: 'dreamledger.tri-llm-evidence-receipt/v1',
    contractVersion: 'dreamledger.tri-llm-worker/v1',
    inputDigest, contextVersion, policyVersion, checkedAt,
    models: results, verdict, consensus, status,
    limitations: [
      'LLM consensus is not proof of factual correctness.',
      'SHA-256 proves integrity, not truth, payment settlement, or fulfillment.',
      'This worker does not initiate payment or fulfillment.'
    ]
  };
  const receiptSha256 = sha256(canonicalJson(receiptBody));
  return { status, verdict, inputDigest, modelResults: results, receipt: { ...receiptBody, receiptSha256 } };
}
