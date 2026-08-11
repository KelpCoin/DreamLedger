'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const DATA_ROOT = path.resolve(process.env.DEMAND_RADAR_DATA_DIR || process.env.LEDGER_DATA_DIR || path.join(ROOT, 'data', 'demand'));
const EVENTS = path.join(DATA_ROOT, 'events.jsonl');

function ensure() {
  fs.mkdirSync(DATA_ROOT, { recursive: true });
  if (!fs.existsSync(EVENTS)) fs.writeFileSync(EVENTS, '', 'utf8');
}

function stableKey(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex').slice(0, 16);
}

function record(type, meta = {}) {
  ensure();
  const event = {
    event_id: `DEMAND-${stableKey(`${Date.now()}:${type}:${JSON.stringify(meta)}`)}`,
    at: new Date().toISOString(),
    type: String(type).slice(0, 80),
    silo: String(meta.silo || 'dreamledger').slice(0, 40),
    route: String(meta.route || '').slice(0, 160),
    source: String(meta.source || 'runtime').slice(0, 40)
  };
  fs.appendFileSync(EVENTS, JSON.stringify(event) + '\n', 'utf8');
  return event;
}

function summary(limit = 20) {
  ensure();
  const lines = fs.readFileSync(EVENTS, 'utf8').split(/\r?\n/).filter(Boolean).slice(-5000);
  const counts = new Map();
  for (const line of lines) {
    try {
      const e = JSON.parse(line);
      const key = `${e.silo}:${e.type}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    } catch {}
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, Math.max(1, Number(limit) || 20));
  return {
    schema: 'BEC-PRIME/DEMAND-RADAR/v1',
    event_count: lines.length,
    ranked_signals: ranked.map(([key, count]) => {
      const [silo, type] = key.split(':');
      return { silo, signal: type, count };
    }),
    policy: 'Signals create proposals only. They never publish, charge, mutate catalog truth, or execute external actions.'
  };
}

function proposal() {
  const ranked = summary(10).ranked_signals;
  const top = ranked[0] || null;
  if (!top) return { status: 'NO_SIGNAL', proposal: null };
  return {
    status: 'PROPOSED',
    proposal: {
      proposal_id: `DEMAND-P-${stableKey(JSON.stringify(top))}`,
      trigger: top,
      suggested_action: 'create_or_refine_candidate_surface',
      approval_required: true,
      publish_allowed: false,
      charge_allowed: false,
      external_action_allowed: false
    }
  };
}

module.exports = { record, summary, proposal, EVENTS };
