'use strict';

const crypto = require('crypto');

const COUNT = Number(process.env.DL_SCALE_COUNT || 100000);
const SILOS = ['MTG', 'DIGITAL', 'SERVICE'];
const PRICE_CENTS = 100;

function sku(i) {
  return 'SCALE-' + String(i).padStart(6, '0');
}

function idempotencyKey(skuValue) {
  return 'dreamledger-checkout-' + crypto.createHash('sha256').update(skuValue, 'utf8').digest('hex').slice(0, 32);
}

function makeProduct(i) {
  const id = sku(i);
  return {
    id,
    name: 'Scale Fixture ' + id,
    silo: SILOS[i % SILOS.length],
    status: 'published',
    price: PRICE_CENTS,
    currency: 'nzd',
    inventory: 1,
    checkout_enabled: true,
    stripe_mode: 'dynamic_checkout_session',
    idempotency_key: idempotencyKey(id)
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function main() {
  assert(Number.isInteger(COUNT) && COUNT > 0 && COUNT <= 1000000, 'DL_SCALE_COUNT must be an integer from 1 to 1000000');

  const ids = new Set();
  const keys = new Set();
  let checkoutable = 0;
  const siloCounts = Object.fromEntries(SILOS.map(s => [s, 0]));

  for (let i = 1; i <= COUNT; i += 1) {
    const p = makeProduct(i);
    assert(!ids.has(p.id), 'duplicate SKU: ' + p.id);
    assert(!keys.has(p.idempotency_key), 'duplicate idempotency key: ' + p.id);
    assert(Number.isInteger(p.price) && p.price > 0, 'invalid price: ' + p.id);
    assert(p.currency === 'nzd', 'invalid currency: ' + p.id);
    assert(p.status === 'published', 'invalid status: ' + p.id);
    assert(p.inventory > 0, 'invalid inventory: ' + p.id);
    assert(p.checkout_enabled === true, 'checkout not enabled: ' + p.id);
    ids.add(p.id);
    keys.add(p.idempotency_key);
    siloCounts[p.silo] += 1;
    checkoutable += 1;
  }

  const result = {
    schema: 'dreamledger-commerce-scale-smoke/v1',
    status: 'PASS',
    generated_count: COUNT,
    unique_skus: ids.size,
    unique_idempotency_keys: keys.size,
    checkoutable_count: checkoutable,
    price_contract_test_cents: PRICE_CENTS,
    price_contract_note: 'Synthetic fixture value only. Does not establish or select the live NZ$25/NZ$29 commercial price contract.',
    stripe_objects_created: 0,
    stripe_api_calls_made: 0,
    silo_counts: siloCounts,
    guardrails: {
      no_stripe_side_effects: true,
      deterministic_sku_generation: true,
      deterministic_checkout_idempotency: true,
      client_authoritative_price: false,
      approval_required_before_live_activation: true
    }
  };

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

if (require.main === module) main();
module.exports = { makeProduct, idempotencyKey };
