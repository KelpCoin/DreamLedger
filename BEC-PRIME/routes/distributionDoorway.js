'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ledger = require('../runtime/Ledger');
const ROOT = path.join(__dirname, '..');
const CONFIG = path.join(ROOT, 'distribution', 'config.json');
function loadConfig() { return JSON.parse(fs.readFileSync(CONFIG, 'utf8')); }
function safeText(value, max) { return String(value || '').slice(0, max || 160); }
function hashIp(req) { const ip = req.socket?.remoteAddress || 'unknown'; return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16); }
function handle(req, res) {
  const url = new URL(req.url || '/', 'http://localhost');
  if (req.method !== 'GET' || url.pathname !== '/go') return false;
  const cfg = loadConfig();
  const q = url.searchParams;
  const source = safeText(q.get('utm_source') || q.get('src') || 'direct');
  const medium = safeText(q.get('utm_medium') || 'direct');
  const campaign = safeText(q.get('utm_campaign') || q.get('campaign') || cfg.default_campaign);
  const placement = safeText(q.get('placement') || 'unknown');
  const experimentId = safeText(q.get('experiment_id') || q.get('experiment') || 'none');
  const offerId = safeText(q.get('offer_id') || q.get('offer') || cfg.default_offer);
  const event = ledger.appendEvent({
    graph_id: 'BEC-DISTRIBUTION',
    branch_id: campaign,
    node_id: 'canonical-doorway',
    event_type: 'DOORWAY_VISIT',
    silo: 'SILO_DREAMLEDGER',
    payload: {
      doorway_id: cfg.doorway_id,
      source,
      medium,
      campaign,
      placement,
      experiment_id: experimentId,
      offer_id: offerId,
      ip_hash: hashIp(req),
      user_agent: safeText(req.headers['user-agent'], 240)
    }
  });
  const target = new URL(cfg.destination_path, 'https://dreamledger.org');
  target.searchParams.set('utm_source', source);
  target.searchParams.set('utm_medium', medium);
  target.searchParams.set('utm_campaign', campaign);
  if (placement !== 'unknown') target.searchParams.set('placement', placement);
  if (experimentId !== 'none') target.searchParams.set('experiment_id', experimentId);
  if (offerId) target.searchParams.set('offer_id', offerId);
  res.writeHead(302, {
    Location: target.pathname + target.search,
    'Cache-Control': 'no-store',
    'X-BEC-Doorway-Event': event.event_id
  });
  res.end();
  return true;
}
module.exports = { handle };
