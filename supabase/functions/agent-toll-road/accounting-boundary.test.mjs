import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('facilitator settlement observation never claims settled or delivered before reconciliation', () => {
  const source=readFileSync(new URL('./index.ts', import.meta.url),'utf8');
  assert.match(source,/buyer_action_verified: false, payment_settled: false, fulfilment_verified: false, evidence_verified: false/);
  assert.match(source,/scoreboard_eligible: false, delivery_verified: false/);
  assert.match(source,/fulfillment_state: "UNMATCHED"/);
  assert.doesNotMatch(source,/scoreboard_eligible: !TESTNET/);
  assert.match(source,/receipt_scope: "ARTIFACT_PREPARED_NOT_CONFIRMED_RECEIVED"/);
  assert.match(source,/status: "PENDING"/);
});

test('existing agent x402 endpoint is not silently repriced or moved to a different network', () => {
  const source=readFileSync(new URL('./index.ts', import.meta.url),'utf8');
  assert.match(source,/"POST \/v1\/compare_quotes": \{/);
  assert.match(source,/price: "\$0\.50", network: NETWORK/);
  assert.match(source,/NETWORK = Deno\.env\.get\("X402_NETWORK"\)/);
  assert.match(source,/QUOTE_ENABLED = Deno\.env\.get\("X402_QUOTE_ENABLED"\)/);
});
