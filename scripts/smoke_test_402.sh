#!/usr/bin/env bash
# Unpaid x402 v2 challenge smoke test. Does not sign or send a payment.
set -euo pipefail
ENDPOINT="${1:-https://api.dreamledger.org/v1/compare_quotes}"
IDEMPOTENCY_KEY="smoke-$(date +%s)-$RANDOM"
EXPECTED_PAY_TO="${X402_PAY_TO_ADDRESS:-${X402_PAY_TO:-}}"
echo "=== x402 402 Smoke Test ==="
echo "Endpoint: $ENDPOINT"
response="$(curl -sS --max-time 30 -w '\n%{http_code}' -X POST "$ENDPOINT" -H 'Content-Type: application/json' -H "X-Idempotency-Key: $IDEMPOTENCY_KEY" -d '{"documents":[{"content":"Supplier A: total $100, MOQ 10, lead time 5 days","type":"text"},{"content":"Supplier B: total $95, MOQ 20, lead time 7 days","type":"text"}]}')"
http_code="$(printf '%s\n' "$response" | tail -n1)"
body="$(printf '%s\n' "$response" | sed '$d')"
printf 'HTTP Status: %s\n' "$http_code"
printf '%s\n' "$body" | jq . 2>/dev/null || printf '%s\n' "$body"
[ "$http_code" = "402" ] || { echo "SMOKE TEST: FAILED (expected HTTP 402)"; exit 1; }
x402_version="$(printf '%s' "$body" | jq -r '.x402Version // empty')"
scheme="$(printf '%s' "$body" | jq -r '.accepts[0].scheme // empty')"
network="$(printf '%s' "$body" | jq -r '.accepts[0].network // empty')"
amount="$(printf '%s' "$body" | jq -r '.accepts[0].maxAmountRequired // .accepts[0].amount // empty')"
pay_to="$(printf '%s' "$body" | jq -r '.accepts[0].payTo // empty')"
asset="$(printf '%s' "$body" | jq -r '.accepts[0].asset // empty')"
failed=0
[ "$x402_version" = "2" ] || { echo "FAIL: x402Version expected 2"; failed=1; }
[ "$scheme" = "exact" ] || { echo "FAIL: scheme expected exact"; failed=1; }
[ "$network" = "eip155:84532" ] || { echo "FAIL: network expected eip155:84532"; failed=1; }
[ "$amount" = "500000" ] || { echo "FAIL: amount expected 500000 atomic USDC"; failed=1; }
[ "${asset,,}" = "0x036cbd53842c5426634e7929541ec2318f3dcf7e" ] || { echo "FAIL: asset is not Base Sepolia USDC"; failed=1; }
[ -n "$pay_to" ] && [ "$pay_to" != "null" ] || { echo "FAIL: payTo missing"; failed=1; }
if [ -n "$EXPECTED_PAY_TO" ] && [ "${pay_to,,}" != "${EXPECTED_PAY_TO,,}" ]; then echo "FAIL: payTo does not match configured receiver"; failed=1; fi
if [ "$failed" -ne 0 ]; then echo "SMOKE TEST: FAILED"; exit 1; fi
echo "SMOKE TEST: PASSED"
