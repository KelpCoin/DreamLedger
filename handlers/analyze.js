'use strict';
// BECK Evidence Triage: bounded, non-billable prototype.
// This service hashes user-supplied evidence metadata. It does NOT visit URLs,
// evaluate whether a claim is true, or grant paid entitlements.
const crypto = require('node:crypto');
const MAX_BYTES = 8192;
const MAX_CLAIM = 1000;
const MAX_SOURCES = 10;
const MAX_EXCERPT = 600;
function respond(res, code, body) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(body));
}
function bad(res, code, error) { return respond(res, code, { ok: false, error }); }
function sourceUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const u = new URL(value.trim());
    if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password) return null;
    u.hash = '';
    return u.toString();
  } catch { return null; }
}
function normalise(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    return { error: 'JSON_OBJECT_REQUIRED' };
  const claim = typeof body.claim === 'string' ? body.claim.trim() : '';
  if (!claim || claim.length > MAX_CLAIM) return { error: 'CLAIM_LENGTH_INVALID' };
  if (!Array.isArray(body.sources) || body.sources.length > MAX_SOURCES)
    return { error: 'SOURCES_ARRAY_REQUIRED_MAX_10' };
  const byUrl = new Map();
  for (const entry of body.sources) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry))
      return { error: 'SOURCE_OBJECT_REQUIRED' };
    const url = sourceUrl(entry.url);
    if (!url) return { error: 'SOURCE_URL_INVALID' };
    const excerpt = typeof entry.excerpt === 'string' ? entry.excerpt.trim() : '';
    if (excerpt.length > MAX_EXCERPT) return { error: 'SOURCE_EXCERPT_TOO_LONG' };
    const observed = entry.observed_at == null ? '' : String(entry.observed_at);
    if (observed && (observed.length > 40 || !Number.isFinite(Date.parse(observed))))
      return { error: 'SOURCE_DATE_INVALID' };
    // Repeated URLs do not count as independent sources. Same URL keeps
    // the lexicographically first payload so receipts don't depend on order.
    const row = { url, excerpt, observed_at: observed };
    const old = byUrl.get(url);
    if (!old || JSON.stringify(row) < JSON.stringify(old)) byUrl.set(url, row);
  }
  return { claim, sources: [...byUrl.values()].sort((a, b) => a.url.localeCompare(b.url)) };
}
module.exports = function analyze(req, res) {
  if (req.method === 'GET') return respond(res, 200, {
    service: 'BECK Evidence Triage', version: 'prototype-1',
    method: 'POST', path: '/api/v1/analyze',
    example: { claim: 'Supplier A offers a 14-day lead time', sources: [{ url: 'https://example.org/quote', excerpt: 'Lead time: 14 days', observed_at: '2026-10-27' }] },
    independent_source_verification: false, paid_access_enabled: false,
    notice: 'Free experimental source-inventory and reproducible-receipt API; not an AI fact-checker.'
  });
  if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return bad(res, 405, 'METHOD_NOT_ALLOWED'); }
  const body = req.body;
  if (!body || Buffer.isBuffer(body)) return bad(res, 400, 'JSON_BODY_REQUIRED');
  let serialized;
  try { serialized = JSON.stringify(body); } catch { return bad(res, 400, 'INVALID_JSON_BODY'); }
  if (!serialized || Buffer.byteLength(serialized, 'utf8') > MAX_BYTES)
    return bad(res, 413, 'PAYLOAD_TOO_LARGE');
  const record = normalise(body);
  if (record.error) return bad(res, 422, record.error);
  const gaps = [];
  if (record.sources.length === 0) gaps.push('NO_SOURCES_PROVIDED');
  if (record.sources.some(s => !s.excerpt)) gaps.push('SOURCE_EXCERPT_MISSING');
  if (record.sources.some(s => !s.observed_at)) gaps.push('OBSERVATION_DATE_MISSING');
  gaps.push('INDEPENDENT_SOURCE_CHECK_NOT_PERFORMED');
  const canonical = JSON.stringify({ schema: 'beck/evidence-triage/v1', claim: record.claim, sources: record.sources });
  const digest = crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
  return respond(res, 200, {
    ok: true, schema: 'beck/evidence-triage/v1', verdict: 'NOT_VERIFIED',
    source_count: record.sources.length, input_digest_sha256: digest,
    receipt: { algorithm: 'SHA-256', covers: 'normalized_claim_and_user_supplied_sources', hash: digest },
    gaps, independent_source_verification: false, paid_access_enabled: false,
    retention: 'No application-level storage; hosting-provider infrastructure logs may still exist.',
    notice: 'A matching receipt detects changed input; it does not prove the claim or sources are authentic.'
  });
};
