#!/usr/bin/env node
/**
 * Regression: historical receipt Case D must not lie.
 * - Tests the ledger file under test (not a different file)
 * - SEQ_NOT_IN_CHAIN is failure for a head-receipt test, not PASS
 * - Writing to ledger.jsonl while claiming ledger2.jsonl is invalid
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

function appendReceipt(ledgerPath, entry) {
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
  fs.appendFileSync(ledgerPath, JSON.stringify(entry) + '\n');
}

function readChain(ledgerPath) {
  if (!fs.existsSync(ledgerPath)) return [];
  return fs
    .readFileSync(ledgerPath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function headReceiptOk(ledgerPath, expectedSeq) {
  const chain = readChain(ledgerPath);
  if (!chain.length) return { ok: false, reason: 'EMPTY_LEDGER' };
  const head = chain[chain.length - 1];
  if (head.seq !== expectedSeq) {
    return { ok: false, reason: 'SEQ_NOT_IN_CHAIN', head_seq: head.seq, expected_seq: expectedSeq };
  }
  return { ok: true, reason: 'HEAD_MATCH', head };
}

test('Case D: head-receipt test targets the same ledger it writes', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'beck-receipt-'));
  const ledgerUnderTest = path.join(dir, 'ledger2.jsonl');
  const wrongLedger = path.join(dir, 'ledger.jsonl');

  const seq = 1;
  const entry = {
    seq,
    receipt_id: crypto.randomUUID(),
    observed_at_utc: new Date().toISOString(),
    payload_hash: crypto.createHash('sha256').update('fixture').digest('hex'),
  };

  // Correct behavior: write and read the same path
  appendReceipt(ledgerUnderTest, entry);
  const result = headReceiptOk(ledgerUnderTest, seq);
  assert.equal(result.ok, true, 'same-file write/read must PASS');
  assert.equal(result.reason, 'HEAD_MATCH');

  // Invalid historical pattern: write ledger.jsonl, test ledger2.jsonl
  appendReceipt(wrongLedger, entry);
  const cross = headReceiptOk(ledgerUnderTest, 999);
  assert.equal(cross.ok, false, 'missing seq must not PASS');
  assert.equal(cross.reason, 'SEQ_NOT_IN_CHAIN');
  // SEQ_NOT_IN_CHAIN is explicitly a failure for head-receipt tests
  assert.notEqual(cross.reason, 'PASS');
});

test('SEQ_NOT_IN_CHAIN is never a passing verdict', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'beck-receipt-'));
  const ledger = path.join(dir, 'ledger.jsonl');
  appendReceipt(ledger, { seq: 1, receipt_id: 'r1' });
  const r = headReceiptOk(ledger, 2);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'SEQ_NOT_IN_CHAIN');
  const verdict = r.ok ? 'PASS' : 'FAIL';
  assert.equal(verdict, 'FAIL');
});
