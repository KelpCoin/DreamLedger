'use strict';

const fs = require('fs');
const path = require('path');
const ledger = require('./Ledger');

const ROOT = path.join(__dirname, '..');
const NZ_REGISTRY = path.join(ROOT, 'catalog', 'truth', 'nz-agentic-events.json');

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

function snapshot() {
  const events = ledger.readEvents().filter(isPublic).map(publicEvent);
  const chain = ledger.verifyChain();
  const reported = reportedNzEvents();
  return {
    oracle: 'DreamLedger Truth Oracle',
    version: '1.2',
    purpose: 'Public, machine-readable record of agentic-commerce evidence and sourced public reports.',
    independence_note: 'DreamLedger distinguishes its own ledger evidence from externally reported events. A public report is not treated as independently verified by DreamLedger.',
    agent_authority_statement: 'Agent actions that violate the authority ceiling are recorded as evidence.',
    generated_at: new Date().toISOString(),
    ledger_public_events: events.length,
    nz_public_reports: reported.length,
    chain_status: chain.status,
    last_event_hash: chain.last_event_hash,
    ledger_events: events,
    nz_public_reports: reported
  };
}

function html() {
  const data = snapshot();
  const ledgerRows = data.ledger_events.map(event => `<tr><td>${escapeHtml(event.event_id)}</td><td>${escapeHtml(event.event_type)}</td><td>${escapeHtml(event.timestamp)}</td><td>${escapeHtml(event.result || '')}</td><td><code>${escapeHtml(event.event_hash || '')}</code></td></tr>`).join('');
  const reportRows = data.nz_public_reports.map(record => `<tr><td>${escapeHtml(record.record_id)}</td><td>${escapeHtml(record.date)}</td><td>${escapeHtml(record.category)}</td><td>${escapeHtml(record.status)}</td><td>${escapeHtml(record.description)}<br><a rel="noreferrer" href="${escapeHtml(record.source)}">Source</a></td></tr>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DreamLedger Truth Oracle</title><style>body{font-family:system-ui,sans-serif;max-width:1300px;margin:40px auto;padding:0 20px;background:#0b0d10;color:#e8edf2}a{color:#8ec5ff}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border-bottom:1px solid #303640;padding:10px;text-align:left;font-size:14px;vertical-align:top}code{word-break:break-all}.card{border:1px solid #303640;border-radius:12px;padding:18px;margin:16px 0}small{color:#aab4c0}</style></head><body><h1>DreamLedger Truth Oracle</h1><p>Public evidence index for agentic commerce, with a New Zealand registry.</p><div class="card"><strong>${data.nz_public_reports}</strong> New Zealand public reports and <strong>${data.ledger_public_events}</strong> DreamLedger ledger events. Ledger chain: <strong>${escapeHtml(data.chain_status)}</strong>.<br><small>Evidence classes are explicit: externally reported is not the same as independently verified by DreamLedger.</small></div><div class="card"><strong>Agent authority evidence:</strong> ${escapeHtml(data.agent_authority_statement)}</div><p><a href="/api/truth-oracle">Machine-readable JSON</a></p><h2>New Zealand public reports</h2><table><thead><tr><th>Record</th><th>Date</th><th>Category</th><th>Status</th><th>Evidence</th></tr></thead><tbody>${reportRows || '<tr><td colspan="5">No sourced New Zealand records yet.</td></tr>'}</tbody></table><h2>DreamLedger ledger evidence</h2><table><thead><tr><th>Event</th><th>Type</th><th>Time</th><th>Result</th><th>Hash</th></tr></thead><tbody>${ledgerRows || '<tr><td colspan="5">No explicitly published DreamLedger agentic-commerce events yet.</td></tr>'}</tbody></table></body></html>`;
}

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

module.exports = { snapshot, html, reportedNzEvents };
