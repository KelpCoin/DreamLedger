'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const RESERVE_LUA = String.raw`
-- DLG_RESERVE_V1
local prior = redis.call('GET', KEYS[3])
if prior then
  local p = cjson.decode(prior)
  if p.request_hash == ARGV[1] then return {'DUPLICATE', p.status or 'UNKNOWN'} end
  return {'IDEMPOTENCY_CONFLICT'}
end
local now = tonumber(ARGV[2])
local capacity = tonumber(ARGV[3])
local refill_per_sec = tonumber(ARGV[4])
local wanted_tokens = tonumber(ARGV[5])
local reserve_micro = tonumber(ARGV[6])
local daily_limit = tonumber(ARGV[7])
local ttl = tonumber(ARGV[8])
local tokens = tonumber(redis.call('HGET', KEYS[1], 'tokens')) or capacity
local last = tonumber(redis.call('HGET', KEYS[1], 'last_ms')) or now
tokens = math.min(capacity, tokens + math.max(0, now - last) * refill_per_sec / 1000)
if tokens < wanted_tokens then
  redis.call('HSET', KEYS[1], 'tokens', tostring(tokens), 'last_ms', tostring(now))
  redis.call('EXPIRE', KEYS[1], ttl)
  local wait_ms = math.ceil((wanted_tokens - tokens) / refill_per_sec * 1000)
  return {'RATE_LIMITED', tostring(wait_ms)}
end
local used = tonumber(redis.call('GET', KEYS[2])) or 0
if used + reserve_micro > daily_limit then
  redis.call('HSET', KEYS[1], 'tokens', tostring(tokens), 'last_ms', tostring(now))
  redis.call('EXPIRE', KEYS[1], ttl)
  return {'BUDGET_EXCEEDED', tostring(used), tostring(daily_limit)}
end
tokens = tokens - wanted_tokens
redis.call('HSET', KEYS[1], 'tokens', tostring(tokens), 'last_ms', tostring(now))
redis.call('EXPIRE', KEYS[1], ttl)
redis.call('INCRBY', KEYS[2], reserve_micro)
redis.call('EXPIRE', KEYS[2], ttl)
local reservation = cjson.encode({
  status = 'RESERVED',
  request_hash = ARGV[1],
  reserved_micro = reserve_micro,
  reserved_tokens = wanted_tokens,
  daily_limit_micro = daily_limit
})
redis.call('SET', KEYS[3], reservation, 'EX', ttl)
return {'RESERVED', tostring(tokens), tostring(used + reserve_micro)}
`;

const SETTLE_LUA = String.raw`
-- DLG_SETTLE_V1
local raw = redis.call('GET', KEYS[3])
if not raw then return {'RESERVATION_MISSING'} end
local p = cjson.decode(raw)
if p.status == 'SETTLED' then return {'DUPLICATE_SETTLEMENT'} end
if p.status ~= 'RESERVED' and p.status ~= 'UNKNOWN_CHARGE' then return {'INVALID_STATE', p.status} end
local actual_micro = tonumber(ARGV[1])
local actual_tokens = tonumber(ARGV[2])
local capacity = tonumber(ARGV[3])
local used = tonumber(redis.call('GET', KEYS[2])) or 0
local delta = actual_micro - tonumber(p.reserved_micro)
redis.call('INCRBY', KEYS[2], delta)
local bucket_tokens = tonumber(redis.call('HGET', KEYS[1], 'tokens')) or 0
local adjusted = math.min(capacity, math.max(0, bucket_tokens + tonumber(p.reserved_tokens) - actual_tokens))
redis.call('HSET', KEYS[1], 'tokens', tostring(adjusted))
p.status = 'SETTLED'
p.actual_micro = actual_micro
p.actual_tokens = actual_tokens
p.over_budget = ((used + delta) > tonumber(p.daily_limit_micro)) or (actual_micro > tonumber(p.reserved_micro)) or (actual_tokens > tonumber(p.reserved_tokens))
redis.call('SET', KEYS[3], cjson.encode(p), 'EX', 604800)
if p.over_budget then return {'SETTLED_OVER_BUDGET', tostring(used + delta)} end
return {'SETTLED', tostring(used + delta)}
`;

const CANCEL_LUA = String.raw`
-- DLG_CANCEL_V1
local raw = redis.call('GET', KEYS[3])
if not raw then return {'RESERVATION_MISSING'} end
local p = cjson.decode(raw)
if p.status == 'CANCELLED' then return {'CANCELLED'} end
if p.status ~= 'RESERVED' then return {'INVALID_STATE', p.status} end
redis.call('INCRBY', KEYS[2], -tonumber(p.reserved_micro))
local tokens = tonumber(redis.call('HGET', KEYS[1], 'tokens')) or 0
tokens = math.min(tonumber(ARGV[1]), tokens + tonumber(p.reserved_tokens))
redis.call('HSET', KEYS[1], 'tokens', tostring(tokens))
p.status = 'CANCELLED'
redis.call('SET', KEYS[3], cjson.encode(p), 'EX', 604800)
return {'CANCELLED'}
`;

const UNKNOWN_LUA = String.raw`
-- DLG_UNKNOWN_V1
local raw = redis.call('GET', KEYS[3])
if not raw then return {'RESERVATION_MISSING'} end
local p = cjson.decode(raw)
if p.status == 'RESERVED' then
  p.status = 'UNKNOWN_CHARGE'
  redis.call('SET', KEYS[3], cjson.encode(p), 'EX', 604800)
  return {'UNKNOWN_CHARGE'}
end
return {'UNCHANGED', p.status}
`;

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function safeId(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 128
    && /^[A-Za-z0-9._:-]+$/.test(value);
}

function finiteNonNegative(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function toMicroNzd(value) {
  if (!finiteNonNegative(value)) throw new Error('NZD amount must be finite and non-negative');
  return Math.floor(value * 1000000 + 1e-7);
}

function nzdFromMicro(value) {
  return Number(value) / 1000000;
}

function extractUsage(result) {
  const usage = result && result.usage;
  if (!usage || typeof usage !== 'object') return null;
  const input = usage.prompt_tokens ?? usage.input_tokens;
  const output = usage.completion_tokens ?? usage.output_tokens;
  const cached = usage.prompt_tokens_details?.cached_tokens ?? usage.input_tokens_details?.cached_tokens ?? 0;
  if (![input, output, cached].every(Number.isInteger) || input < 0 || output < 0 || cached < 0 || cached > input) return null;
  return { inputTokens: input, outputTokens: output, cachedInputTokens: cached };
}

function priceUsageMicroNzd(usage, price) {
  const normalInput = usage.inputTokens - usage.cachedInputTokens;
  const cachedPrice = price.cachedInputNzdPerMillion ?? price.inputNzdPerMillion;
  return Math.ceil(
    normalInput * price.inputNzdPerMillion
    + usage.cachedInputTokens * cachedPrice
    + usage.outputTokens * price.outputNzdPerMillion
  );
}

function appendHashChainedJsonl(filePath, event) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  let previousHash = 'GENESIS';
  if (fs.existsSync(filePath)) {
    const integrity = verifyUsageLedger(filePath);
    if (!integrity.ok) throw new Error('Usage ledger integrity verification failed before append: ' + integrity.reason);
    const raw = fs.readFileSync(filePath, 'utf8');
    const lines = raw.split(/\r?\n/).filter(Boolean);
    if (lines.length) {
      const last = JSON.parse(lines[lines.length - 1]);
      if (typeof last.record_hash !== 'string') throw new Error('Usage ledger last record has no hash');
      previousHash = last.record_hash;
    }
  }
  const body = { ...event, previous_hash: previousHash };
  const record = { ...body, record_hash: sha256(JSON.stringify(body)) };
  fs.appendFileSync(filePath, JSON.stringify(record) + '\n', { encoding: 'utf8', flag: 'a', mode: 0o600 });
  try { fs.chmodSync(filePath, 0o600); } catch (_) { /* platform may not support POSIX modes */ }
  return record;
}

function verifyUsageLedger(filePath) {
  if (!fs.existsSync(filePath)) return { ok: false, reason: 'LEDGER_MISSING', records: 0 };
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean);
  let expectedPrevious = 'GENESIS';
  for (let i = 0; i < lines.length; i++) {
    let record;
    try { record = JSON.parse(lines[i]); } catch (_) {
      return { ok: false, reason: 'INVALID_JSON', line: i + 1, records: i };
    }
    const storedHash = record.record_hash;
    const body = { ...record };
    delete body.record_hash;
    if (body.previous_hash !== expectedPrevious || typeof storedHash !== 'string' || sha256(JSON.stringify(body)) !== storedHash) {
      return { ok: false, reason: 'HASH_CHAIN_MISMATCH', line: i + 1, records: i };
    }
    expectedPrevious = storedHash;
  }
  return { ok: true, reason: 'PASS', records: lines.length, head_hash: expectedPrevious };
}

class RedisAtomicBudgetStore {
  constructor(redis, clock = Date.now) {
    if (!redis || typeof redis.eval !== 'function') throw new Error('Redis-compatible atomic eval is required');
    this.redis = redis;
    this.clock = clock;
  }

  keys(input) {
    const agentHash = sha256(input.agentId);
    const modelHash = sha256(input.modelId);
    const jobHash = sha256(input.idempotencyKey);
    return {
      bucket: 'dl:budget:v1:bucket:' + agentHash + ':' + modelHash,
      budget: 'dl:budget:v1:daily:' + agentHash + ':' + input.utcDate,
      reservation: 'dl:budget:v1:reservation:' + agentHash + ':' + jobHash
    };
  }

  async reserve(input) {
    const k = this.keys(input);
    const result = await this.redis.eval(RESERVE_LUA, {
      keys: [k.bucket, k.budget, k.reservation],
      arguments: [
        input.requestHash, String(input.nowMs), String(input.bucketCapacityTokens),
        String(input.refillTokensPerSecond), String(input.reservedTokens),
        String(input.reservedMicroNzd), String(input.dailyLimitMicroNzd), '172800'
      ]
    });
    const status = String(result?.[0] || 'STORE_ERROR');
    if (status === 'RESERVED') return { allowed: true, status, keys: k, requestHash: input.requestHash, reservedTokens: input.reservedTokens, reservedMicroNzd: input.reservedMicroNzd, dailyLimitMicroNzd: input.dailyLimitMicroNzd, bucketCapacityTokens: input.bucketCapacityTokens };
    if (status === 'RATE_LIMITED') return { allowed: false, status, retryAfterMs: Number(result[1]) || 0 };
    if (status === 'BUDGET_EXCEEDED') return { allowed: false, status, usedMicroNzd: Number(result[1]) || 0, dailyLimitMicroNzd: Number(result[2]) || input.dailyLimitMicroNzd };
    if (status === 'DUPLICATE') return { allowed: false, status, priorStatus: String(result[1] || 'UNKNOWN') };
    if (status === 'IDEMPOTENCY_CONFLICT') return { allowed: false, status };
    return { allowed: false, status: 'STORE_ERROR', detail: status };
  }

  async settle(reservation, actualMicroNzd, actualTokens) {
    const k = reservation.keys;
    const result = await this.redis.eval(SETTLE_LUA, {
      keys: [k.bucket, k.budget, k.reservation],
      arguments: [String(actualMicroNzd), String(actualTokens), String(reservation.bucketCapacityTokens)]
    });
    return { status: String(result?.[0] || 'STORE_ERROR'), usedMicroNzd: Number(result?.[1]) || null };
  }

  async cancel(reservation) {
    const result = await this.redis.eval(CANCEL_LUA, {
      keys: [reservation.keys.bucket, reservation.keys.budget, reservation.keys.reservation],
      arguments: [String(reservation.bucketCapacityTokens)]
    });
    return { status: String(result?.[0] || 'STORE_ERROR') };
  }

  async markUnknown(reservation) {
    const result = await this.redis.eval(UNKNOWN_LUA, {
      keys: [reservation.keys.bucket, reservation.keys.budget, reservation.keys.reservation],
      arguments: []
    });
    return { status: String(result?.[0] || 'STORE_ERROR') };
  }
}

function createAgentBudgetGateway(options = {}) {
  const { redis, store: suppliedStore, priceTable, agentPolicies, ledgerPath, clock = Date.now, estimateInputTokens } = options;
  if (typeof estimateInputTokens !== 'function') throw new Error('Trusted model-specific estimateInputTokens function is required');
  if (!priceTable || typeof priceTable !== 'object') throw new Error('Explicit price table is required');
  if (!agentPolicies || typeof agentPolicies !== 'object') throw new Error('Explicit per-agent policies are required');
  if (typeof ledgerPath !== 'string' || !path.isAbsolute(ledgerPath)) throw new Error('An absolute usage ledger path is required');
  const store = suppliedStore || new RedisAtomicBudgetStore(redis, clock);

  async function execute(input) {
    const { agentId, modelId, request, maxOutputTokens, idempotencyKey, invoke } = input || {};
    if (!safeId(agentId) || !safeId(modelId) || !safeId(idempotencyKey)) {
      return { status: 400, allowed: false, reason: 'INVALID_IDENTITY_OR_IDEMPOTENCY_KEY' };
    }
    if (!request || typeof request !== 'object'
      || !Number.isInteger(maxOutputTokens) || maxOutputTokens <= 0 || typeof invoke !== 'function') {
      return { status: 400, allowed: false, reason: 'INVALID_REQUEST_CONTRACT' };
    }
    let inputTokenCount;
    try { inputTokenCount = estimateInputTokens(request, modelId); } catch (_) {
      return { status: 503, allowed: false, reason: 'INPUT_TOKEN_ESTIMATION_FAILED_PROVIDER_NOT_CALLED' };
    }
    if (!Number.isInteger(inputTokenCount) || inputTokenCount < 0) {
      return { status: 503, allowed: false, reason: 'INPUT_TOKEN_ESTIMATION_UNAVAILABLE_PROVIDER_NOT_CALLED' };
    }
    const policy = agentPolicies[agentId];
    const price = priceTable[modelId];
    if (!policy || !price || !finiteNonNegative(policy.dailyBudgetNzd)
      || !Number.isInteger(policy.bucketCapacityTokens) || policy.bucketCapacityTokens <= 0
      || !finiteNonNegative(policy.refillTokensPerSecond) || policy.refillTokensPerSecond <= 0
      || !finiteNonNegative(price.inputNzdPerMillion) || !finiteNonNegative(price.outputNzdPerMillion)
      || (price.cachedInputNzdPerMillion !== undefined && !finiteNonNegative(price.cachedInputNzdPerMillion))) {
      return { status: 503, allowed: false, reason: 'MISSING_OR_INVALID_BUDGET_POLICY_OR_PRICE' };
    }
    const reservedTokens = inputTokenCount + maxOutputTokens;
    if (reservedTokens > policy.bucketCapacityTokens) {
      return { status: 429, allowed: false, reason: 'REQUEST_EXCEEDS_TOKEN_BUCKET_CAPACITY' };
    }
    const worstCaseInputRate = Math.max(price.inputNzdPerMillion, price.cachedInputNzdPerMillion ?? price.inputNzdPerMillion);
    const reservedMicroNzd = Math.ceil(inputTokenCount * worstCaseInputRate + maxOutputTokens * price.outputNzdPerMillion);
    const dailyLimitMicroNzd = toMicroNzd(policy.dailyBudgetNzd);
    const requestHash = sha256(JSON.stringify({ modelId, request, inputTokenCount, maxOutputTokens }));
    const nowMs = clock();
    const utcDate = new Date(nowMs).toISOString().slice(0, 10);
    let reservation;
    try {
      reservation = await store.reserve({
        agentId, modelId, idempotencyKey, requestHash, nowMs, utcDate,
        reservedTokens, reservedMicroNzd, dailyLimitMicroNzd,
        bucketCapacityTokens: policy.bucketCapacityTokens,
        refillTokensPerSecond: policy.refillTokensPerSecond
      });
    } catch (_) {
      return { status: 503, allowed: false, reason: 'BUDGET_STORE_UNAVAILABLE_PROVIDER_NOT_CALLED' };
    }
    if (!reservation || reservation.allowed !== true) {
      const statusMap = { RATE_LIMITED: 429, BUDGET_EXCEEDED: 429, DUPLICATE: 409, IDEMPOTENCY_CONFLICT: 409, STORE_ERROR: 503 };
      return {
        status: statusMap[reservation?.status] || 503,
        allowed: false,
        reason: reservation?.status || 'BUDGET_STORE_FAIL_CLOSED',
        retry_after_ms: reservation?.retryAfterMs,
        prior_status: reservation?.priorStatus
      };
    }
    reservation.bucketCapacityTokens = policy.bucketCapacityTokens;
    const baseEvent = {
      timestamp: new Date(nowMs).toISOString(),
      event_type: 'MODEL_CALL_RESERVED',
      agent_id: agentId,
      model_id: modelId,
      idempotency_key_hash: sha256(idempotencyKey),
      request_hash: requestHash,
      input_tokens_estimated: inputTokenCount,
      output_tokens_reserved: maxOutputTokens,
      reserved_tokens: reservedTokens,
      reserved_cost_nzd: nzdFromMicro(reservedMicroNzd),
      daily_budget_nzd: policy.dailyBudgetNzd,
      pricing_version: String(price.version || 'UNVERSIONED')
    };
    try {
      appendHashChainedJsonl(ledgerPath, baseEvent);
    } catch (_) {
      try { await store.cancel(reservation); } catch (_) { /* reservation remains charged if release fails */ }
      return { status: 503, allowed: false, reason: 'USAGE_LEDGER_PREWRITE_FAILED_PROVIDER_NOT_CALLED' };
    }

    let result;
    try {
      result = await invoke(request, { maxOutputTokens });
    } catch (error) {
      try {
        appendHashChainedJsonl(ledgerPath, {
          timestamp: new Date(clock()).toISOString(),
          event_type: 'MODEL_CALL_UNKNOWN_CHARGE',
          agent_id: agentId,
          model_id: modelId,
          idempotency_key_hash: sha256(idempotencyKey),
          reserved_cost_nzd: nzdFromMicro(reservedMicroNzd),
          reason: 'PROVIDER_ERROR_USAGE_UNCONFIRMED'
        });
      } catch (_) { /* budget reservation is retained */ }
      try { await store.markUnknown(reservation); } catch (_) { /* budget reservation is retained */ }
      return { status: 502, allowed: false, reason: 'PROVIDER_ERROR_CHARGE_UNCONFIRMED_DO_NOT_RETRY', error_class: error?.name || 'Error' };
    }

    const usage = extractUsage(result);
    if (!usage) {
      try { await store.markUnknown(reservation); } catch (_) { /* hold reservation */ }
      try {
        appendHashChainedJsonl(ledgerPath, {
          timestamp: new Date(clock()).toISOString(),
          event_type: 'MODEL_CALL_UNKNOWN_CHARGE',
          agent_id: agentId,
          model_id: modelId,
          idempotency_key_hash: sha256(idempotencyKey),
          reserved_cost_nzd: nzdFromMicro(reservedMicroNzd),
          reason: 'PROVIDER_USAGE_METADATA_MISSING_OR_INVALID'
        });
      } catch (_) { /* hold reservation */ }
      return { status: 502, allowed: false, reason: 'USAGE_UNVERIFIED_RESERVATION_HELD_DO_NOT_RETRY' };
    }

    const actualMicroNzd = priceUsageMicroNzd(usage, price);
    const actualTokens = usage.inputTokens + usage.outputTokens;
    try {
      appendHashChainedJsonl(ledgerPath, {
        timestamp: new Date(clock()).toISOString(),
        event_type: 'MODEL_CALL_USAGE_OBSERVED',
        agent_id: agentId,
        model_id: modelId,
        idempotency_key_hash: sha256(idempotencyKey),
        input_tokens: usage.inputTokens,
        output_tokens: usage.outputTokens,
        cached_input_tokens: usage.cachedInputTokens,
        cost_nzd: nzdFromMicro(actualMicroNzd),
        cost_micro_nzd: actualMicroNzd,
        reserved_cost_nzd: nzdFromMicro(reservedMicroNzd),
        pricing_version: String(price.version || 'UNVERSIONED')
      });
    } catch (_) {
      try { await store.markUnknown(reservation); } catch (_) { /* hold full reservation */ }
      return { status: 503, allowed: false, reason: 'POST_CALL_LEDGER_FAILED_RESERVATION_HELD_RECONCILIATION_REQUIRED' };
    }

    let settlement;
    try {
      settlement = await store.settle(reservation, actualMicroNzd, actualTokens);
    } catch (_) {
      return { status: 503, allowed: false, reason: 'BUDGET_SETTLEMENT_FAILED_RESERVATION_HELD_RECONCILIATION_REQUIRED' };
    }
    if (!settlement || !['SETTLED', 'SETTLED_OVER_BUDGET'].includes(settlement.status)) {
      return { status: 503, allowed: false, reason: 'BUDGET_SETTLEMENT_UNCONFIRMED_RECONCILIATION_REQUIRED' };
    }
    try {
      appendHashChainedJsonl(ledgerPath, {
        timestamp: new Date(clock()).toISOString(),
        event_type: 'MODEL_CALL_BUDGET_RECONCILED',
        agent_id: agentId,
        model_id: modelId,
        idempotency_key_hash: sha256(idempotencyKey),
        cost_nzd: nzdFromMicro(actualMicroNzd),
        budget_store_status: settlement.status,
        over_budget: settlement.status === 'SETTLED_OVER_BUDGET'
      });
    } catch (_) {
      return { status: 503, allowed: false, reason: 'RECONCILIATION_LEDGER_FAILED_PROVIDER_RESULT_WITHHELD' };
    }
    if (settlement.status === 'SETTLED_OVER_BUDGET') {
      return { status: 429, allowed: false, reason: 'PROVIDER_USAGE_EXCEEDED_RESERVATION_OR_DAILY_BUDGET_STOP_AGENT', cost_nzd: nzdFromMicro(actualMicroNzd) };
    }
    return { status: 200, allowed: true, result, usage, cost_nzd: nzdFromMicro(actualMicroNzd) };
  }

  return { execute };
}

module.exports = {
  createAgentBudgetGateway,
  RedisAtomicBudgetStore,
  appendHashChainedJsonl,
  verifyUsageLedger,
  extractUsage,
  priceUsageMicroNzd
};
