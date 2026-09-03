'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const LEDGER_DIR = path.resolve(process.env.BEC_LEDGER_DIR || process.env.LEDGER_DATA_DIR || path.join(ROOT, 'data', 'ledger'));
const EVENTS_FILE = path.join(LEDGER_DIR, 'EVENTS.jsonl');
const LOCK_FILE = path.join(LEDGER_DIR, '.events.lock');

fs.mkdirSync(LEDGER_DIR, { recursive: true });

function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
}

function sha256(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : canonical(value), 'utf8').digest('hex');
}

function readEvents() {
  if (!fs.existsSync(EVENTS_FILE)) return [];
  const text = fs.readFileSync(EVENTS_FILE, 'utf8');
  return text.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
}

function lastHash() {
  const events = readEvents();
  return events.length ? events[events.length - 1].event_hash : null;
}

function appendEvent(input) {
  if (!input || typeof input !== 'object') throw new Error('event input must be an object');
  const event = {
    schema_version: 'BEC-EVENT-1.0',
    event_id: input.event_id || `evt_${new Date().toISOString().replace(/[-:.TZ]/g, '')}_${crypto.randomBytes(4).toString('hex')}`,
    previous_event_hash: lastHash(),
    timestamp: input.timestamp || new Date().toISOString(),
    graph_id: input.graph_id || 'BEC-RUNTIME',
    branch_id: input.branch_id || input.job_id || 'runtime',
    node_id: input.node_id || 'runtime',
    event_type: input.event_type || 'RUNTIME_EVENT',
    silo: input.silo || 'BEC-PRIME',
    actor: input.actor || { type: 'executor', id: 'bec-runtime' },
    inputs_hash: input.inputs_hash || null,
    outputs_hash: input.outputs_hash || null,
    payload: input.payload || {},
    claims: input.claims || { payment_claim: false, sale_claim: false, fulfillment_claim: false },
    evidence_refs: input.evidence_refs || [],
    result: input.result || 'PASS'
  };
  event.event_hash = `sha256:${sha256(event)}`;
  const fd = fs.openSync(EVENTS_FILE, 'a');
  try {
    fs.writeSync(fd, JSON.stringify(event) + '\n', null, 'utf8');
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  return event;
}

function acquireLock() {
  const staleAfterMs = 30000;
  for (let attempt = 0; attempt < 600; attempt += 1) {
    try {
      const fd = fs.openSync(LOCK_FILE, 'wx');
      fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, created_at: new Date().toISOString() }));
      fs.closeSync(fd);
      return;
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      try {
        const stat = fs.statSync(LOCK_FILE);
        if (Date.now() - stat.mtimeMs > staleAfterMs) fs.unlinkSync(LOCK_FILE);
      } catch {}
      const waitUntil = Date.now() + 10;
      while (Date.now() < waitUntil) {}
    }
  }
  throw new Error('Timed out acquiring ledger append lock');
}

function releaseLock() {
  try { fs.unlinkSync(LOCK_FILE); } catch (err) { if (err.code !== 'ENOENT') throw err; }
}

function appendEventIdempotent(input) {
  if (!input || typeof input !== 'object') throw new Error('event input must be an object');
  if (!input.event_id) throw new Error('event_id is required for idempotent append');
  acquireLock();
  try {
    const existing = readEvents().find(event => event.event_id === input.event_id);
    if (existing) return { event: existing, idempotent: true };
    return { event: appendEvent(input), idempotent: false };
  } finally {
    releaseLock();
  }
}

function verifyChain() {
  const events = readEvents();
  let previous = null;
  const failures = [];
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    if (event.previous_event_hash !== previous) failures.push(`event ${index + 1}: previous_event_hash mismatch`);
    const body = { ...event };
    delete body.event_hash;
    if (`sha256:${sha256(body)}` !== event.event_hash) failures.push(`event ${index + 1}: event_hash mismatch`);
    previous = event.event_hash;
  }
  return { status: failures.length ? 'FAIL' : 'PASS', checked_events: events.length, last_event_hash: previous, failures };
}

module.exports = { canonical, sha256, readEvents, appendEvent, appendEventIdempotent, verifyChain, EVENTS_FILE, LEDGER_DIR };
