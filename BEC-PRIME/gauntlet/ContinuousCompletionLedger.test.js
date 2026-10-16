'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {
  evaluateAndRecordEconomicEvent,
  evaluateAndRecordCloneIsolation
} = require('./ContinuousCompletionLedger');

function makeLedger(options = {}) {
  const events = new Map();
  const sha256 = value => crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
  const ledger = {
    events,
    canonical: value => JSON.stringify(value),
    sha256,
    verifyChain: () => ({ status: options.chainStatus || 'PASS', checked_events: events.size }),
    appendEventIdempotent(input) {
      if (events.has(input.event_id)) return { event: events.get(input.event_id), idempotent: true };
      const event = {
        ...input,
        event_hash: 'sha256:' + sha256(input)
      };
      events.set(input.event_id, event);
      return { event, idempotent: false };
    }
  };
  return ledger;
}

test('economic verdict is persisted once to the canonical ledger and never claims money', () => {
  const ledger = makeLedger();
  const input = {
    candidateId: 'RA_000001',
    verifiedAt: '2026-10-16T08:30:00.000Z',
    signalResults: {}
  };
  const first = evaluateAndRecordEconomicEvent(input, { ledger });
  assert.equal(first.recorded, true);
  assert.equal(first.status, 'RECORDED');
  assert.equal(first.verdict_record.typed_verdict, 'NEEDS_EVIDENCE');
  assert.equal(ledger.events.size, 1);
  const event = ledger.events.get(first.event_id);
  assert.equal(event.event_type, 'GAUNTLET_CONTINUOUS_COMPLETION_EVALUATED');
  assert.equal(event.claims.payment_claim, false);
  assert.equal(event.claims.sale_claim, false);
  assert.equal(event.claims.fulfillment_claim, false);
  assert.equal(event.payload.score_only_not_revenue, true);
  assert.equal(event.payload.verdict_record.binary_gate_pass, false);
});

test('same evidence and timestamp produce an idempotent decision event', () => {
  const ledger = makeLedger();
  const input = {
    candidateId: 'RA_000001',
    verifiedAt: '2026-10-16T08:31:00.000Z',
    signalResults: {}
  };
  const first = evaluateAndRecordEconomicEvent(input, { ledger });
  const second = evaluateAndRecordEconomicEvent(input, { ledger });
  assert.equal(first.event_id, second.event_id);
  assert.equal(first.status, 'RECORDED');
  assert.equal(second.status, 'RECORDED_IDEMPOTENT');
  assert.equal(ledger.events.size, 1);
});

test('invalid existing ledger chain blocks the write and preserves the verdict', () => {
  const ledger = makeLedger({ chainStatus: 'FAIL' });
  const result = evaluateAndRecordEconomicEvent({
    candidateId: 'RA_000001',
    verifiedAt: '2026-10-16T08:32:00.000Z',
    signalResults: {}
  }, { ledger });
  assert.equal(result.recorded, false);
  assert.equal(result.status, 'HOLD_LEDGER_CHAIN_INVALID');
  assert.equal(result.verdict_record.typed_verdict, 'NEEDS_EVIDENCE');
  assert.equal(ledger.events.size, 0);
});

test('clone isolation verdicts use the same ledger with neutral economic claims', () => {
  const ledger = makeLedger();
  const result = evaluateAndRecordCloneIsolation({
    cloneId: 'clone-mtg-review-only',
    verifiedAt: '2026-10-16T08:33:00.000Z',
    dimensionResults: {}
  }, { ledger });
  assert.equal(result.recorded, true);
  assert.equal(result.event_id.startsWith('evt_completion_'), true);
  const event = ledger.events.get(result.event_id);
  assert.equal(event.event_type, 'GAUNTLET_CLONE_ISOLATION_EVALUATED');
  assert.equal(event.claims.payment_claim, false);
  assert.equal(event.claims.sale_claim, false);
  assert.equal(event.claims.fulfillment_claim, false);
});

test('ledger append exceptions fail closed and do not report a recorded verdict', () => {
  const ledger = makeLedger();
  ledger.appendEventIdempotent = () => { throw new Error('disk unavailable'); };
  const result = evaluateAndRecordEconomicEvent({
    candidateId: 'RA_000001',
    verifiedAt: '2026-10-16T08:34:00.000Z',
    signalResults: {}
  }, { ledger });
  assert.equal(result.recorded, false);
  assert.equal(result.status, 'HOLD_LEDGER_APPEND_FAILED');
});
