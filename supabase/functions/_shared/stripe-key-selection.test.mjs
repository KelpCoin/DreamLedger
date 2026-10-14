import test from 'node:test';
import assert from 'node:assert/strict';
import { pickStripeApiKey } from './stripe-key-selection.mjs';

test('whitespace-only primary key does not shadow a valid fallback', () => {
  assert.equal(pickStripeApiKey('   \t ', ' FALLBACK_KEY_EXAMPLE '), 'FALLBACK_KEY_EXAMPLE');
});

test('valid primary key has precedence and is trimmed', () => {
  assert.equal(pickStripeApiKey(' RESTRICTED_KEY_EXAMPLE ', 'FALLBACK_KEY_EXAMPLE'), 'RESTRICTED_KEY_EXAMPLE');
});

test('empty primary falls back to the secondary key', () => {
  assert.equal(pickStripeApiKey('', ' FALLBACK_KEY_EXAMPLE '), 'FALLBACK_KEY_EXAMPLE');
});

test('missing or whitespace-only keys fail closed', () => {
  assert.equal(pickStripeApiKey(undefined, undefined), null);
  assert.equal(pickStripeApiKey('   ', '\n \t'), null);
});

test('non-string values are not interpreted as credentials', () => {
  assert.equal(pickStripeApiKey({ value: 'NOT_A_STRING_EXAMPLE' }, 'VALID_KEY_EXAMPLE'), 'VALID_KEY_EXAMPLE');
});
