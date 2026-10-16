'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

test('held Commander diagnostic refuses checkout before creating an intake or Stripe session', async () => {
  const prior = process.env.STRIPE_SECRET_KEY;
  process.env.STRIPE_SECRET_KEY = 'test-only-not-a-real-stripe-secret';
  const modulePath = require.resolve('./mtgDiagnosticFulfillment');
  delete require.cache[modulePath];
  const diagnostic = require('./mtgDiagnosticFulfillment');
  try {
    await assert.rejects(
      diagnostic.createCheckout({ decklist: '1 Sol Ring\n1 Arcane Signet\n1 Command Tower\n1 Island\n1 Swamp\n1 Mountain\n1 Forest\n1 Plains\n1 Swords to Plowshares\n1 Counterspell' }),
      error => error.statusCode === 409 && /CANONICAL_PRODUCT_HELD/.test(error.message)
    );
  } finally {
    if (prior === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = prior;
    delete require.cache[modulePath];
  }
});
