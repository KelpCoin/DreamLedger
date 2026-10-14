import test from 'node:test';
import assert from 'node:assert/strict';
import { pickStripeApiKey } from './stripe-key-selection.mjs';

test('whitespace-only primary key does not shadow a valid fallback', () => {
  assert.equal(pickStripeApiKey('   \t ', ' sk_live_fallback-test '), 'sk_live_fallback-test');
});

test('valid primary key has precedence and is trimmed', () => {
  assert.equal(pickStripeApiKey(' rk_live_restricted-test ', 'sk_live_fallback-test'), 'rk_live_restricted-test');
});

test('empty primary falls back to the secondary key', () => {
  assert.equal(pickStripeApiKey('', ' sk_live_fallback-test '), 'sk_live_fallback-test');
});

test('missing or whitespace-only keys fail closed', () => {
  assert.equal(pickStripeApiKey(undefined, undefined), null);
  assert.equal(pickStripeApiKey('   ', '\n \t'), null);
});

test('non-string values are not interpreted as credentials', () => {
  assert.equal(pickStripeApiKey({ value: 'sk_live_not-a-string' }, 'sk_live_valid-test'), 'sk_live_valid-test');
});
