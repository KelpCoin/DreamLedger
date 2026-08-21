'use strict';

const ledger = require('./Ledger');

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

function snapshot() {
  const events = ledger.readEvents().filter(isPublic).map(publicEvent);
  const chain = ledger.verifyChain();
  return {
    oracle: 'DreamLedger Truth Oracle',
    version: '1.0',
    purpose: 'Public, machine-readable record of explicitly published agentic-commerce evidence.',
    independence_note: 'The Oracle exposes issuer-supplied evidence and chain integrity; it does not independently attest to facts that are not evidenced.',
    generated_at: new Date().toISOString(),
    verified_public_events: events.length,
    chain_status: chain.status,
    last_event_hash: chain.last_event_hash,
    events
  };
}

function html() {
  const data = snapshot();
  const rows = data.events.map(event => `<tr><td>${escapeHtml(event.event_id)}</td><td>${escapeHtml(event.event_type)}</td><td>${escapeHtml(event.timestamp)}</td><td>${escapeHtml(event.result || '')}</td><td><code>${escapeHtml(event.event_hash || '')}</code></td></tr>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DreamLedger Truth Oracle</title><style>body{font-family:system-ui,sans-serif;max-width:1200px;margin:40px auto;padding:0 20px;background:#0b0d10;color:#e8edf2}a{color:#8ec5ff}table{width:100%;border-collapse:collapse;margin-top:24px}th,td{border-bottom:1px solid #303640;padding:10px;text-align:left;font-size:14px}code{word-break:break-all}.card{border:1px solid #303640;border-radius:12px;padding:18px;margin:16px 0}small{color:#aab4c0}</style></head><body><h1>DreamLedger Truth Oracle</h1><p>Public evidence index for agentic commerce.</p><div class="card"><strong>${data.verified_public_events}</strong> explicitly published events. Chain integrity: <strong>${escapeHtml(data.chain_status)}</strong>.<br><small>The Oracle records evidence. It does not turn an issuer claim into independent fact.</small></div><p><a href="/api/truth-oracle">Machine-readable JSON</a></p><table><thead><tr><th>Event</th><th>Type</th><th>Time</th><th>Result</th><th>Hash</th></tr></thead><tbody>${rows || '<tr><td colspan="5">No explicitly published agentic-commerce events yet.</td></tr>'}</tbody></table></body></html>`;
}

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

module.exports = { snapshot, html };
