'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  createAgentBudgetGateway,
  verifyUsageLedger
} = require('./agentBudgetGateway');

class MemoryAtomicStore {
  constructor(clock = Date.now) {
    this.clock = clock;
    this.buckets = new Map();
    this.daily = new Map();
    this.reservations = new Map();
  }

  async reserve(input) {
    const reservationKey = input.agentId + ':' + input.idempotencyKey;
    const previous = this.reservations.get(reservationKey);
    if (previous) {
      return previous.requestHash === input.requestHash
        ? { allowed: false, status: 'DUPLICATE', priorStatus: previous.statusInternal }
        : { allowed: false, status: 'IDEMPOTENCY_CONFLICT' };
    }

    const bucketKey = input.agentId + ':' + input.modelId;
    const dailyKey = input.agentId + ':' + input.utcDate;
    const now = input.nowMs;
    let bucket = this.buckets.get(bucketKey);
    if (!bucket) bucket = { tokens: input.bucketCapacityTokens, lastMs: now };
    bucket.tokens = Math.min(
      input.bucketCapacityTokens,
      bucket.tokens + Math.max(0, now - bucket.lastMs) * input.refillTokensPerSecond / 1000
    );
    bucket.lastMs = now;

    if (bucket.tokens < input.reservedTokens) {
      this.buckets.set(bucketKey, bucket);
      return { allowed: false, status: 'RATE_LIMITED', retryAfterMs: Math.ceil((input.reservedTokens - bucket.tokens) / input.refillTokensPerSecond * 1000) };
    }

    const used = this.daily.get(dailyKey) || 0;
    if (used + input.reservedMicroNzd > input.dailyLimitMicroNzd) {
      this.buckets.set(bucketKey, bucket);
      return { allowed: false, status: 'BUDGET_EXCEEDED', usedMicroNzd: used, dailyLimitMicroNzd: input.dailyLimitMicroNzd };
    }

    bucket.tokens -= input.reservedTokens;
    this.buckets.set(bucketKey, bucket);
    this.daily.set(dailyKey, used + input.reservedMicroNzd);
    const reservation = {
      allowed: true,
      status: 'RESERVED',
      requestHash: input.requestHash,
      reservedTokens: input.reservedTokens,
      reservedMicroNzd: input.reservedMicroNzd,
      dailyLimitMicroNzd: input.dailyLimitMicroNzd,
      bucketCapacityTokens: input.bucketCapacityTokens,
      memoryKey: reservationKey,
      bucketKey,
      dailyKey,
      statusInternal: 'RESERVED'
    };
    this.reservations.set(reservationKey, reservation);
    return reservation;
  }

  async settle(reservation, actualMicroNzd, actualTokens) {
    const p = this.reservations.get(reservation.memoryKey);
    if (!p) return { status: 'RESERVATION_MISSING' };
    if (p.statusInternal === 'SETTLED') return { status: 'DUPLICATE_SETTLEMENT' };
    if (!['RESERVED', 'UNKNOWN_CHARGE'].includes(p.statusInternal)) return { status: 'INVALID_STATE' };

    this.daily.set(p.dailyKey, (this.daily.get(p.dailyKey) || 0) + actualMicroNzd - p.reservedMicroNzd);
    const bucket = this.buckets.get(p.bucketKey) || { tokens: 0, lastMs: this.clock() };
    bucket.tokens = Math.min(p.bucketCapacityTokens, Math.max(0, bucket.tokens + p.reservedTokens - actualTokens));
    this.buckets.set(p.bucketKey, bucket);
    p.statusInternal = 'SETTLED';
    const overBudget = (this.daily.get(p.dailyKey) || 0) > p.dailyLimitMicroNzd
      || actualMicroNzd > p.reservedMicroNzd || actualTokens > p.reservedTokens;
    return { status: overBudget ? 'SETTLED_OVER_BUDGET' : 'SETTLED' };
  }

  async cancel(reservation) {
    const p = this.reservations.get(reservation.memoryKey);
    if (!p || p.statusInternal !== 'RESERVED') return { status: 'INVALID_STATE' };
    this.daily.set(p.dailyKey, (this.daily.get(p.dailyKey) || 0) - p.reservedMicroNzd);
    const bucket = this.buckets.get(p.bucketKey) || { tokens: 0, lastMs: this.clock() };
    bucket.tokens = Math.min(p.bucketCapacityTokens, bucket.tokens + p.reservedTokens);
    this.buckets.set(p.bucketKey, bucket);
    p.statusInternal = 'CANCELLED';
    return { status: 'CANCELLED' };
  }

  async markUnknown(reservation) {
    const p = this.reservations.get(reservation.memoryKey);
    if (p && p.statusInternal === 'RESERVED') p.statusInternal = 'UNKNOWN_CHARGE';
    return { status: p?.statusInternal || 'RESERVATION_MISSING' };
  }
}

function fixture(options = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dreamledger-agent-budget-'));
  let now = Date.parse('2026-10-16T07:00:00.000Z');
  const clock = () => now;
  const store = new MemoryAtomicStore(clock);
  const base = {
    redis: null,
    store,
    priceTable: {
      'model-a': { inputNzdPerMillion: 1, outputNzdPerMillion: 1, version: 'test-price-v1' },
      'model-b': { inputNzdPerMillion: 2, outputNzdPerMillion: 3, version: 'test-price-v1' }
    },
    agentPolicies: {
      investigator: { dailyBudgetNzd: 0.0001, bucketCapacityTokens: 100, refillTokensPerSecond: 1 },
      tri_llm_critic: { dailyBudgetNzd: 0.0001, bucketCapacityTokens: 100, refillTokensPerSecond: 1 }
    },
    ledgerPath: path.join(directory, 'usage.jsonl'),
    clock,
    estimateInputTokens: (request) => {
      const message = Array.isArray(request?.messages) ? request.messages.find((item) => item?.role === 'user') : null;
      if (!message || typeof message.content !== 'string') throw new Error('Test tokenizer cannot count request');
      return message.content.length;
    }
  };
  return {
    gateway: createAgentBudgetGateway({ ...base, ...options }),
    store,
    ledgerPath: base.ledgerPath,
    advance(ms) { now += ms; }
  };
}

function request(overrides = {}) {
  const { inputTokens: requestedTestTokenCount = 10, request: suppliedRequest, ...rest } = overrides;
  return {
    agentId: 'investigator',
    modelId: 'model-a',
    request: suppliedRequest || {
      model: 'model-a',
      messages: [{ role: 'user', content: 'x'.repeat(requestedTestTokenCount) }]
    },
    maxOutputTokens: 10,
    idempotencyKey: 'job-001',
    invoke: async () => ({
      id: 'provider-response-redacted',
      usage: { prompt_tokens: 10, completion_tokens: 5 },
      choices: [{ message: { content: 'test answer' } }]
    }),
    ...rest
  };
}

test('valid request reserves first, meters actual usage, and emits hash-chained ledger', async () => {
  const f = fixture();
  const result = await f.gateway.execute(request());
  assert.equal(result.status, 200);
  assert.equal(result.allowed, true);
  assert.equal(result.cost_nzd, 0.000015);
  const verified = verifyUsageLedger(f.ledgerPath);
  assert.equal(verified.ok, true);
  assert.equal(verified.records, 3);
});

test('hard daily budget rejects locally before provider invocation', async () => {
  const f = fixture({
    agentPolicies: { investigator: { dailyBudgetNzd: 0.00001, bucketCapacityTokens: 100, refillTokensPerSecond: 1 } }
  });
  let called = 0;
  const result = await f.gateway.execute(request({
    inputTokens: 20,
    maxOutputTokens: 20,
    invoke: async () => { called++; throw new Error('must not run'); }
  }));
  assert.equal(result.status, 429);
  assert.equal(result.reason, 'BUDGET_EXCEEDED');
  assert.equal(called, 0);
  assert.equal(fs.existsSync(f.ledgerPath), false);
});

test('unavailable trusted input tokenizer fails before provider invocation', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dreamledger-agent-budget-no-tokenizer-'));
  assert.throws(() => createAgentBudgetGateway({
    priceTable: { 'model-a': { inputNzdPerMillion: 1, outputNzdPerMillion: 1 } },
    agentPolicies: { investigator: { dailyBudgetNzd: 1, bucketCapacityTokens: 100, refillTokensPerSecond: 1 } },
    ledgerPath: path.join(directory, 'usage.jsonl')
  }), /Trusted model-specific estimateInputTokens function is required/);

  const f = fixture({
    estimateInputTokens: () => { throw new Error('tokenizer unavailable'); }
  });
  let called = 0;
  const result = await f.gateway.execute(request({ invoke: async () => { called++; return {}; } }));
  assert.equal(result.status, 503);
  assert.equal(result.reason, 'INPUT_TOKEN_ESTIMATION_FAILED_PROVIDER_NOT_CALLED');
  assert.equal(called, 0);
});

test('unknown model pricing fails closed before provider invocation', async () => {
  const f = fixture();
  let called = 0;
  const result = await f.gateway.execute(request({
    modelId: 'not-priced',
    invoke: async () => { called++; return {}; }
  }));
  assert.equal(result.status, 503);
  assert.equal(result.reason, 'MISSING_OR_INVALID_BUDGET_POLICY_OR_PRICE');
  assert.equal(called, 0);
});

test('per-agent and per-model buckets are isolated', async () => {
  const policy = {
    investigator: { dailyBudgetNzd: 1, bucketCapacityTokens: 100, refillTokensPerSecond: 1 },
    tri_llm_critic: { dailyBudgetNzd: 1, bucketCapacityTokens: 100, refillTokensPerSecond: 1 }
  };
  const f = fixture({ agentPolicies: policy });
  const expensiveUsage = async () => ({ usage: { input_tokens: 60, output_tokens: 30 } });
  const a1 = await f.gateway.execute(request({ idempotencyKey: 'a-1', inputTokens: 60, maxOutputTokens: 30, invoke: expensiveUsage }));
  assert.equal(a1.status, 200);
  const a2 = await f.gateway.execute(request({ idempotencyKey: 'a-2', inputTokens: 60, maxOutputTokens: 30, invoke: expensiveUsage }));
  assert.equal(a2.status, 429);
  assert.equal(a2.reason, 'RATE_LIMITED');
  const b = await f.gateway.execute(request({
    agentId: 'tri_llm_critic',
    idempotencyKey: 'b-1',
    inputTokens: 60,
    maxOutputTokens: 30,
    invoke: expensiveUsage
  }));
  assert.equal(b.status, 200);
});

test('duplicate job key never repeats the provider call', async () => {
  const f = fixture();
  let calls = 0;
  const req = request({ invoke: async () => { calls++; return { usage: { input_tokens: 10, output_tokens: 5 } }; } });
  assert.equal((await f.gateway.execute(req)).status, 200);
  const duplicate = await f.gateway.execute(req);
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.reason, 'DUPLICATE');
  assert.equal(calls, 1);
});

test('provider failure retains reservation and retries fail closed', async () => {
  const f = fixture();
  let calls = 0;
  const req = request({ invoke: async () => { calls++; throw new Error('provider unavailable'); } });
  const first = await f.gateway.execute(req);
  const second = await f.gateway.execute(req);
  assert.equal(first.reason, 'PROVIDER_ERROR_CHARGE_UNCONFIRMED_DO_NOT_RETRY');
  assert.equal(second.status, 409);
  assert.equal(second.reason, 'DUPLICATE');
  assert.equal(calls, 1);
  assert.equal(verifyUsageLedger(f.ledgerPath).ok, true);
});

test('missing usage metadata keeps the reservation and does not invite retry', async () => {
  const f = fixture();
  let calls = 0;
  const req = request({ invoke: async () => { calls++; return { choices: [{ message: { content: 'no usage' } }] }; } });
  const first = await f.gateway.execute(req);
  const second = await f.gateway.execute(req);
  assert.equal(first.reason, 'USAGE_UNVERIFIED_RESERVATION_HELD_DO_NOT_RETRY');
  assert.equal(second.reason, 'DUPLICATE');
  assert.equal(calls, 1);
});

test('tampering with a JSONL record breaks the ledger hash chain', async () => {
  const f = fixture();
  await f.gateway.execute(request());
  const raw = fs.readFileSync(f.ledgerPath, 'utf8').replace('"cost_nzd":0.000015', '"cost_nzd":9.99');
  fs.writeFileSync(f.ledgerPath, raw, 'utf8');
  assert.equal(verifyUsageLedger(f.ledgerPath).ok, false);
});

test('ledger tampering stops later calls before provider invocation', async () => {
  const f = fixture();
  await f.gateway.execute(request());
  const raw = fs.readFileSync(f.ledgerPath, 'utf8').replace('"cost_nzd":0.000015', '"cost_nzd":8.88');
  fs.writeFileSync(f.ledgerPath, raw, 'utf8');
  let calls = 0;
  const result = await f.gateway.execute(request({
    idempotencyKey: 'job-after-tamper',
    invoke: async () => { calls++; return { usage: { input_tokens: 10, output_tokens: 5 } }; }
  }));
  assert.equal(result.status, 503);
  assert.equal(result.reason, 'USAGE_LEDGER_PREWRITE_FAILED_PROVIDER_NOT_CALLED');
  assert.equal(calls, 0);
});

test('actual usage above reservation halts the agent after recording the overrun', async () => {
  const f = fixture();
  const result = await f.gateway.execute(request({
    inputTokens: 10,
    maxOutputTokens: 10,
    invoke: async () => ({ usage: { input_tokens: 10, output_tokens: 11 } })
  }));
  assert.equal(result.status, 429);
  assert.equal(result.reason, 'PROVIDER_USAGE_EXCEEDED_RESERVATION_OR_DAILY_BUDGET_STOP_AGENT');
});

test('cached input uses the explicitly priced cached-token rate', async () => {
  const f = fixture({
    priceTable: {
      'model-a': { inputNzdPerMillion: 2, cachedInputNzdPerMillion: 1, outputNzdPerMillion: 4, version: 'cached-price-v1' }
    }
  });
  const result = await f.gateway.execute(request({
    invoke: async () => ({ usage: { prompt_tokens: 10, completion_tokens: 5, prompt_tokens_details: { cached_tokens: 4 } } })
  }));
  assert.equal(result.status, 200);
  assert.equal(result.cost_nzd, 0.000036);
});
