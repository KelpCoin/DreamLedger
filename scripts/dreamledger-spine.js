// DreamLedger Spine (v0.1)
// Minimal reconciliation core
// Purpose: evolve DreamLedger from passive CI artifact → active truth system

const fs = require('fs');
const path = require('path');

const ROOT = path.join(process.cwd(), '.dreamledger');
const LEDGER = path.join(ROOT, 'ledger.jsonl');
const STATE = path.join(ROOT, 'state.json');

function ensure() {
  if (!fs.existsSync(ROOT)) fs.mkdirSync(ROOT, { recursive: true });
  if (!fs.existsSync(LEDGER)) fs.writeFileSync(LEDGER, '');
  if (!fs.existsSync(STATE)) {
    fs.writeFileSync(STATE, JSON.stringify({ version: 1, last_event: null }, null, 2));
  }
}

function now() {
  return new Date().toISOString();
}

function log(event) {
  ensure();
  const line = JSON.stringify({ ts: now(), ...event });
  fs.appendFileSync(LEDGER, line + "\n");
}

function loadState() {
  ensure();
  return JSON.parse(fs.readFileSync(STATE, 'utf-8'));
}

function saveState(state) {
  ensure();
  fs.writeFileSync(STATE, JSON.stringify(state, null, 2));
}

// Core event ingestion (future: Stripe / GitHub / Render)
function ingest(event) {
  log({ type: 'ingest', event });

  const state = loadState();
  state.last_event = event;
  state.last_updated = now();

  saveState(state);

  return state;
}

// Placeholder reconciliation engine
// Future upgrade: diff Stripe vs GitHub vs Render truth
function reconcile() {
  ensure();

  const state = loadState();

  const result = {
    type: 'reconcile.run',
    status: 'noop',
    last_event: state.last_event,
    ts: now(),
  };

  log(result);

  return result;
}

// CLI entry
if (require.main === module) {
  const [cmd, json] = process.argv.slice(2);

  if (cmd === 'ingest') {
    const event = json ? JSON.parse(json) : {};
    console.log(ingest(event));
  }

  if (cmd === 'reconcile') {
    console.log(reconcile());
  }
}

module.exports = {
  ingest,
  reconcile,
};