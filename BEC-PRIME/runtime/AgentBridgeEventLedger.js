'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const MAX_EVENTS_PER_KEY = 100;
const MAX_IDEMPOTENCY_LENGTH = 200;
let queue = Promise.resolve();

function ledgerPath() {
  const dir = process.env.DREAMLEDGER_AGENT_BRIDGE_DATA_DIR ||
    path.join(process.env.LEDGER_DATA_DIR || path.join(os.tmpdir(), 'dreamledger-ledger'), 'agent-bridge');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  return path.join(dir, 'events.jsonl');
}

function readRows(file) {
  if (!fs.existsSync(file)) return [];
  const raw = fs.readFileSync(file, 'utf8');
  return raw.split('\n').filter(Boolean).map((line) => JSON.parse(line));
}

function hashPayload(payload) {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function acceptEvent({ keyId, idempotencyKey, payload, dataDir } = {}) {
  const task = queue.then(() => {
    if (!keyId || typeof keyId !== 'string') throw Object.assign(new Error('valid_paid_key_required'), { statusCode: 401 });
    if (!idempotencyKey || typeof idempotencyKey !== 'string' || idempotencyKey.length > MAX_IDEMPOTENCY_LENGTH) {
      throw Object.assign(new Error('idempotency_key_required_max_200_chars'), { statusCode: 400 });
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw Object.assign(new Error('event_payload_object_required'), { statusCode: 400 });
    }
    const encoded = JSON.stringify(payload);
    if (Buffer.byteLength(encoded, 'utf8') > 100_000) {
      throw Object.assign(new Error('event_payload_too_large_max_100kb'), { statusCode: 413 });
    }

    const dir = dataDir || process.env.DREAMLEDGER_AGENT_BRIDGE_DATA_DIR ||
      path.join(process.env.LEDGER_DATA_DIR || path.join(os.tmpdir(), 'dreamledger-ledger'), 'agent-bridge');
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const file = path.join(dir, 'events.jsonl');
    const rows = readRows(file);
    const payloadHash = hashPayload(payload);
    const duplicate = rows.find((row) => row.key_id === keyId && row.idempotency_key === idempotencyKey);
    if (duplicate) {
      if (duplicate.payload_sha256 !== payloadHash) {
        throw Object.assign(new Error('idempotency_key_reused_with_different_payload'), { statusCode: 409 });
      }
      return { ...duplicate, replay: true, remaining: Math.max(0, MAX_EVENTS_PER_KEY - rows.filter((row) => row.key_id === keyId).length) };
    }

    const used = rows.filter((row) => row.key_id === keyId).length;
    if (used >= MAX_EVENTS_PER_KEY) {
      throw Object.assign(new Error('agent_bridge_event_allowance_exhausted'), { statusCode: 429 });
    }

    const row = {
      schema: 'dreamledger/agent-bridge-receipt/v1',
      receipt_id: 'ABR-' + crypto.randomUUID(),
      key_id: keyId,
      idempotency_key: idempotencyKey,
      payload_sha256: payloadHash,
      payload_keys: Object.keys(payload).sort().slice(0, 100),
      accepted_at: new Date().toISOString(),
      status: 'DURABLY_RECORDED'
    };
    fs.appendFileSync(file, JSON.stringify(row) + '\n', { encoding: 'utf8', mode: 0o600, flag: 'a' });
    return { ...row, replay: false, remaining: Math.max(0, MAX_EVENTS_PER_KEY - used - 1) };
  });
  queue = task.catch(() => undefined);
  return task;
}

module.exports = { acceptEvent, MAX_EVENTS_PER_KEY, hashPayload };
