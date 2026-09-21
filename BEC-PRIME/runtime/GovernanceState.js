'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const FILE = path.resolve(process.env.DL_GOVERNANCE_STATE_FILE || path.join(ROOT, 'data', 'governance', 'state.json'));

function now() { return new Date().toISOString(); }
function hash(value) { return crypto.createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex'); }

function initial() {
  return {
    schema_version: 'DL-GOVERNANCE-STATE-1.0',
    kill_state: 'ARMED',
    kill_reason: null,
    kill_actor: null,
    tripped_at: null,
    garage: {},
    canary: { control_percent: 90, treatment_percent: 10, status: 'READY' },
    updated_at: now()
  };
}
function ensure() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, JSON.stringify(initial(), null, 2) + '\n', 'utf8');
}
function read() { ensure(); return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
function write(state) {
  ensure();
  const next = { ...state, updated_at: now() };
  next.state_hash = 'sha256:' + hash(next);
  const tmp = FILE + '.tmp-' + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, FILE);
  return next;
}
function status() { return read(); }
function trip(reason, actor) {
  const current = read();
  if (current.kill_state === 'TRIPPED' || current.kill_state === 'FROZEN') return current;
  return write({ ...current, kill_state: 'TRIPPED', kill_reason: String(reason || 'unspecified'), kill_actor: String(actor || 'automatic-circuit-breaker'), tripped_at: now() });
}
function freeze(reason, actor) {
  return write({ ...read(), kill_state: 'FROZEN', kill_reason: String(reason || 'manual-freeze'), kill_actor: String(actor || 'human') , tripped_at: now() });
}
function reset(actor) {
  const current = read();
  if (current.kill_state === 'ARMED') return current;
  return write({ ...current, kill_state: 'ARMED', kill_reason: null, kill_actor: String(actor || 'human'), tripped_at: null });
}
function setGarage(id, value) {
  const current = read();
  const garage = { ...current.garage, [String(id)]: value };
  return write({ ...current, garage });
}
function getGarage(id) { return read().garage[String(id)] || null; }

module.exports = { FILE, status, trip, freeze, reset, setGarage, getGarage };
