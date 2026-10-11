'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Ledger = require('./AgentBridgeEventLedger');

function freshDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'dreamledger-agent-bridge-test-'));
}

test('writes a durable receipt without storing the raw payload', async () => {
  const dir = freshDir();
  try {
    const payload = { task: 'classify', secretText: 'do not persist this raw value' };
    const result = await Ledger.acceptEvent({ keyId: 'key-a', idempotencyKey: 'evt-1', payload, dataDir: dir });
    assert.equal(result.status, 'DURABLY_RECORDED');
    assert.equal(result.remaining, 99);
    const stored = fs.readFileSync(path.join(dir, 'events.jsonl'), 'utf8');
    assert.match(stored, /payload_sha256/);
    assert.doesNotMatch(stored, /do not persist this raw value/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('same key and idempotency key replay the same receipt without double-counting', async () => {
  const dir = freshDir();
  try {
    const args = { keyId: 'key-b', idempotencyKey: 'evt-1', payload: { x: 1 }, dataDir: dir };
    const first = await Ledger.acceptEvent(args);
    const replay = await Ledger.acceptEvent(args);
    assert.equal(replay.receipt_id, first.receipt_id);
    assert.equal(replay.replay, true);
    assert.equal(replay.remaining, 99);
    assert.equal(fs.readFileSync(path.join(dir, 'events.jsonl'), 'utf8').trim().split('\n').length, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('rejects idempotency-key reuse with a different payload', async () => {
  const dir = freshDir();
  try {
    await Ledger.acceptEvent({ keyId: 'key-c', idempotencyKey: 'evt-1', payload: { x: 1 }, dataDir: dir });
    await assert.rejects(
      Ledger.acceptEvent({ keyId: 'key-c', idempotencyKey: 'evt-1', payload: { x: 2 }, dataDir: dir }),
      (error) => error.statusCode === 409
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('enforces 100 unique events per paid key and isolates other keys', async () => {
  const dir = freshDir();
  try {
    for (let i = 0; i < 100; i++) {
      await Ledger.acceptEvent({ keyId: 'key-d', idempotencyKey: 'evt-' + i, payload: { i }, dataDir: dir });
    }
    await assert.rejects(
      Ledger.acceptEvent({ keyId: 'key-d', idempotencyKey: 'evt-over', payload: { i: 101 }, dataDir: dir }),
      (error) => error.statusCode === 429
    );
    const other = await Ledger.acceptEvent({ keyId: 'key-e', idempotencyKey: 'evt-1', payload: { x: true }, dataDir: dir });
    assert.equal(other.status, 'DURABLY_RECORDED');
    assert.equal(other.remaining, 99);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('requires idempotency and bounds payload size', async () => {
  const dir = freshDir();
  try {
    await assert.rejects(
      Ledger.acceptEvent({ keyId: 'key-f', payload: { x: 1 }, dataDir: dir }),
      (error) => error.statusCode === 400
    );
    await assert.rejects(
      Ledger.acceptEvent({ keyId: 'key-f', idempotencyKey: 'large', payload: { text: 'x'.repeat(100_001) }, dataDir: dir }),
      (error) => error.statusCode === 413
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
