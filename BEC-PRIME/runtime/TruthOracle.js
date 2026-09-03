'use strict';

const fs = require('fs');
const path = require('path');
const ledger = require('./Ledger');

const ROOT = path.join(__dirname, '..');
const NZ_REGISTRY = path.join(ROOT, 'catalog', 'truth', 'nz-agentic-events.json');

const EVIDENCE_TYPES = Object.freeze([
  'OBSERVED',
  'INDEPENDENTLY_VERIFIED',
  'SOURCE_SUPPORT',
  'DERIVED',
  'INFERRED',
  'CONTRADICTED',
  'UNKNOWN'
]);

const WEIGHTS = Object.freeze({
  OBSERVED: 3.0,
  INDEPENDENTLY_VERIFIED: 2.5,
  SOURCE_SUPPORT: 1.0,
  DERIVED: 0.5,
  INFERRED: 0.25,
  CONTRADICTED: -2.0,
  UNKNOWN: 0.0
});

const CONFIDENCE_BANDS = Object.freeze([
  [0, 20, 'VERY LOW'],
  [21, 40, 'LOW'],
  [41, 60, 'MODERATE'],
  [61, 80, 'HIGH'],
  [81, 100, 'VERY HIGH']
]);

function publicEvent(event) {
  const payload = event && event.payload && typeof event.payload === 'object' ? event.payload : {};
  return {
    event_id: event.event_id,
    event_type: event.event_type,
    timestamp: event.timestamp,
    silo: event.silo,
    actor: event.actor && { type: event.actor.type, id: event.actor.id },
    claims: event.claims || {},
    evidence_refs: Array.isArray(event.evidence_refs) ? event.evidence_refs : [],
    result: event.result,
    event_hash: event.event_hash,
    previous_event_hash: event.previous_event_hash,
    correlation: payload.public_correlation || payload.correlation || null
  };
}

function isPublic(event) {
  const payload = event && event.payload && typeof event.payload === 'object' ? event.payload : {};
  return payload.public === true || event.event_type === 'AGENTIC_COMMERCE_TRANSACTION';
}

function reportedNzEvents() {
  if (!fs.existsSync(NZ_REGISTRY)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(NZ_REGISTRY, 'utf8'));
    return Array.isArray(data.records) ? data.records : [];
  } catch {
    return [];
  }
}

function ageDays(timestamp, now = Date.now()) {
  const parsed = Date.parse(timestamp || '');
  if (!Number.isFinite(parsed)) return 365;
  return Math.max(0, (now - parsed) / 86400000);
}

function effectiveWeight(type, timestamp, now = Date.now()) {
  const base = Object.prototype.hasOwnProperty.call(WEIGHTS, type) ? WEIGHTS[type] : 0;
  return base * Math.max(0.5, 1 - ageDays(timestamp, now) / 365);
}

function confidenceScore(evidence = [], unresolvedCount = 0, now = Date.now()) {
  let score = 10;
  for (const item of evidence) {
    const type = EVIDENCE_TYPES.includes(item.type) ? item.type : 'UNKNOWN';
    score += effectiveWeight(type, item.timestamp || item.observed_at || item.source_timestamp, now);
  }
  score -= Math.max(0, Number(unresolvedCount) || 0) * 1.5;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function confidenceBand(score) {
  const value = Math.max(0, Math.min(100, Number(score) || 0));
  const band = CONFIDENCE_BANDS.find(([min, max]) => value >= min && value <= max);
  return band ? band[2] : 'VERY LOW';
}

function normalizeRegistryRecord(record) {
  const status = String(record.status || 'UNKNOWN').toUpperCase();
  let type = 'SOURCE_SUPPORT';
  if (status === 'VERIFIED' || status === 'INDEPENDENTLY_VERIFIED') type = 'INDEPENDENTLY_VERIFIED';
  if (status === 'CONTRADICTED') type = 'CONTRADICTED';
  if (status === 'UNKNOWN' || status === 'UNRESOLVED') type = 'UNKNOWN';
  const evidence = [{
    type,
    source_type: 'PUBLIC_REGISTRY',
    source_id: record.record_id || null,
    source_timestamp: record.date || null,
    observed_at: record.date || null,
    description: record.description || null,
    public: true
  }];
  const score = confidenceScore(evidence, type === 'UNKNOWN' ? 1 : 0);
  return {
    claim_id: 'nz:' + String(record.record_id || '').replace(/[^A-Za-z0-9:_-]/g, ''),
    category: String(record.category || 'ECONOMIC_CLAIM'),
    claim: record.description || 'Unspecified public economic claim',
    verdict: type === 'CONTRADICTED' ? 'CONTRADICTED' : type === 'UNKNOWN' ? 'UNKNOWN' : 'SUPPORTED',
    confidence: score,
    confidence_band: confidenceBand(score),
    evidence_count: evidence.length,
    contradictory_count: type === 'CONTRADICTED' ? 1 : 0,
    unresolved_count: type === 'UNKNOWN' ? 1 : 0,
    last_updated: record.date || null,
    evidence
  };
}

function economicClaims() {
  return reportedNzEvents().map(normalizeRegistryRecord);
}

function snapshot() {
  const events = ledger.readEvents().filter(isPublic).map(publicEvent);
  const chain = ledger.verifyChain();
  const reported = reportedNzEvents();
  const claims = economicClaims();
  return {
    oracle: 'DreamLedger Truth Oracle',
    version: '2.0',
    purpose: 'Public evidence index for economic claims and related real-world records.',
    scope: ['PRICE', 'PAYMENT', 'REVENUE', 'COST', 'OWNERSHIP', 'DEBT', 'BUSINESS', 'TRANSACTION', 'MARKET', 'ECONOMIC_CLAIM', 'COMMERCIAL_EVIDENCE'],
    evidence_types: EVIDENCE_TYPES,
    independence_note: 'A public source is recorded as source support unless the record explicitly establishes independent verification. Missing information remains unknown.',
    truth_payment_rule: 'Entitlement changes disclosure depth, never the underlying verdict or confidence.',
    generated_at: new Date().toISOString(),
    ledger_public_events: events.length,
    nz_public_reports: reported.length,
    economic_claims: claims.length,
    chain_status: chain.status,
    last_event_hash: chain.last_event_hash,
    claims,
    ledger_events: events,
    nz_public_reports: reported
  };
}

function html() {
  const data = snapshot();
  const claimRows = data.claims.map(claim => `<tr><td>${escapeHtml(claim.claim_id)}</td><td>${escapeHtml(claim.category)}</td><td>${escapeHtml(claim.verdict)}</td><td>${escapeHtml(claim.confidence_band)} (${claim.confidence}/100)</td><td>${escapeHtml(claim.claim)}</td></tr>`).join('');
  const ledgerRows = data.ledger_events.map(event => `<tr><td>${escapeHtml(event.event_id)}</td><td>${escapeHtml(event.event_type)}</td><td>${escapeHtml(event.timestamp)}</td><td>${escapeHtml(event.result || '')}</td></tr>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DreamLedger Truth Oracle</title><meta name="description" content="DreamLedger Truth Oracle is a public evidence layer for economic claims, with provenance, contradictions and confidence."><style>body{font-family:system-ui,sans-serif;max-width:1300px;margin:40px auto;padding:0 20px;background:#0b0d10;color:#e8edf2}a{color:#8ec5ff}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border-bottom:1px solid #303640;padding:10px;text-align:left;font-size:14px;vertical-align:top}.card{border:1px solid #303640;border-radius:12px;padding:18px;margin:16px 0}small{color:#aab4c0}</style></head><body><h1>DreamLedger Truth Oracle</h1><p>Public evidence for claims with economic consequences. The Oracle records what evidence supports, what contradicts it, and what remains unknown.</p><div class="card"><strong>${data.economic_claims}</strong> economic claims · <strong>${data.nz_public_reports}</strong> public source records · <strong>${data.ledger_public_events}</strong> published Ledger events.<br><small>${escapeHtml(data.truth_payment_rule)}</small></div><p><a href="/api/truth-oracle">Machine-readable evidence</a></p><h2>Economic claims</h2><table><thead><tr><th>Claim</th><th>Category</th><th>Verdict</th><th>Confidence</th><th>Statement</th></tr></thead><tbody>${claimRows || '<tr><td colspan="5">No public economic claims are currently published.</td></tr>'}</tbody></table><h2>Published Ledger evidence</h2><table><thead><tr><th>Event</th><th>Type</th><th>Time</th><th>Result</th></tr></thead><tbody>${ledgerRows || '<tr><td colspan="4">No published Ledger evidence yet.</td></tr>'}</tbody></table><div class="card"><strong>Evidence boundary</strong><br><small>Source support is not automatically observed fact. A file, database row, checkout session or test event is not by itself proof of a real-world event. Contradictions and unknowns remain visible.</small></div></body></html>`;
}

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

module.exports = {
  snapshot,
  html,
  reportedNzEvents,
  economicClaims,
  confidenceScore,
  confidenceBand,
  effectiveWeight,
  EVIDENCE_TYPES,
  WEIGHTS
};
