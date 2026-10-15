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
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]', '::1'].includes(url.hostname)) {
    throw new Error('LOCAL_ENDPOINT_REQUIRED: LM Studio must remain loopback-only');
  }
  return url;
}
