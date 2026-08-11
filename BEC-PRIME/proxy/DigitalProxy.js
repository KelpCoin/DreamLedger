'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const QUEUE = path.join(ROOT, 'data', 'proxy', 'queue.json');
const AUDIT = path.join(ROOT, 'data', 'proxy', 'audit.jsonl');
const APPROVAL_TOKEN = process.env.DIGITAL_PROXY_APPROVAL_TOKEN || '';

function ensure() {
  fs.mkdirSync(path.dirname(QUEUE), { recursive: true });
  if (!fs.existsSync(QUEUE)) fs.writeFileSync(QUEUE, '{}\n', 'utf8');
  if (!fs.existsSync(AUDIT)) fs.writeFileSync(AUDIT, '', 'utf8');
}
function readQueue() { ensure(); return JSON.parse(fs.readFileSync(QUEUE, 'utf8')); }
function writeQueue(q) { fs.writeFileSync(QUEUE, JSON.stringify(q, null, 2) + '\n', 'utf8'); }
function audit(event) { ensure(); fs.appendFileSync(AUDIT, JSON.stringify({ at: new Date().toISOString(), ...event }) + '\n', 'utf8'); }
function id() { return crypto.randomUUID(); }
function timingSafeEqualText(a, b) { const x = Buffer.from(String(a), 'utf8'); const y = Buffer.from(String(b), 'utf8'); return x.length === y.length && crypto.timingSafeEqual(x, y); }

const SAFE_ACTIONS = new Set(['gauntlet.run', 'elohim.propose', 'dreamiez.generate_reward', 'compile.offers', 'compile.surface']);

function queue(action, payload, requestedBy = 'system') {
  if (!SAFE_ACTIONS.has(action)) throw new Error(`Action not allowlisted: ${action}`);
  const q = readQueue();
  const actionId = id();
  q[actionId] = { action_id: actionId, action, payload: payload || {}, requested_by: requestedBy, status: 'PENDING_APPROVAL', created_at: new Date().toISOString() };
  writeQueue(q);
  audit({ type: 'proxy.queued', action_id: actionId, action, requested_by: requestedBy });
  return q[actionId];
}

function approve(actionId, approver, token) {
  if (!APPROVAL_TOKEN || !timingSafeEqualText(token, APPROVAL_TOKEN)) throw new Error('Valid digital proxy approval token required');
  const q = readQueue();
  const item = q[actionId];
  if (!item) throw new Error('Proxy action not found');
  if (item.status !== 'PENDING_APPROVAL') throw new Error('Proxy action is not pending approval');
  item.status = 'APPROVED';
  item.approved_by = String(approver || 'human');
  item.approved_at = new Date().toISOString();
  writeQueue(q);
  audit({ type: 'proxy.approved', action_id: actionId, approved_by: item.approved_by });
  return item;
}

function claim(actionId) {
  const q = readQueue();
  const item = q[actionId];
  if (!item) throw new Error('Proxy action not found');
  if (item.status !== 'APPROVED') throw new Error('Human approval required');
  item.status = 'EXECUTING';
  item.execution_started_at = new Date().toISOString();
  writeQueue(q);
  audit({ type: 'proxy.execution_started', action_id: actionId, action: item.action });
  return item;
}

function complete(actionId, result) {
  const q = readQueue();
  const item = q[actionId];
  if (!item) throw new Error('Proxy action not found');
  item.status = 'COMPLETED';
  item.result = result;
  item.completed_at = new Date().toISOString();
  writeQueue(q);
  audit({ type: 'proxy.completed', action_id: actionId, action: item.action });
  return item;
}

function fail(actionId, error) {
  const q = readQueue();
  const item = q[actionId];
  if (!item) throw new Error('Proxy action not found');
  item.status = 'FAILED';
  item.error = String(error?.message || error);
  item.failed_at = new Date().toISOString();
  writeQueue(q);
  audit({ type: 'proxy.failed', action_id: actionId, action: item.action, error: item.error });
  return item;
}

module.exports = { queue, approve, claim, complete, fail, SAFE_ACTIONS: [...SAFE_ACTIONS] };
