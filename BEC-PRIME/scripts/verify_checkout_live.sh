#!/usr/bin/env bash
# Production checkout gate for the Render storefront.
# The storefront uses catalog-backed /buy/<product-id> redirects to existing
# Stripe Payment Links. It does not expose the Vercel-only session-create route.
# This verifies offer publication and the real Stripe hand-off, not payment settlement.

set -euo pipefail

BASE_URL="${BASE_URL:-https://dreamledger.org}"
OFFER_ID="${1:?Usage: verify_checkout_live.sh <PRODUCT_ID>}"

fail() { echo "FAIL: $1"; exit 1; }

echo "== DREAMLEDGER LIVE PAYMENT-LINK GATE =="
echo "Target: $BASE_URL"
echo "Product: $OFFER_ID"
echo

echo "[1/3] storefront health..."
HEALTH="$(curl -fsS "$BASE_URL/healthz")" || fail "healthz unreachable"
printf '%s' "$HEALTH" | python3 -c 'import json,sys; d=json.load(sys.stdin); raise SystemExit(0 if d.get("status")=="ok" or d.get("ok") is True else 1)' || fail "storefront health is not ok"
echo "  HEALTH_OK"

echo "[2/3] published offer and payment link..."
OFFERS="$(curl -fsS "$BASE_URL/api/offers")" || fail "offer catalog unreachable"
OFFER_ID="$OFFER_ID" OFFERS_JSON="$OFFERS" python3 - <<'PY'
import json, os, sys
try:
    data = json.loads(os.environ["OFFERS_JSON"])
except Exception as e:
    print(f"INVALID_OFFER_JSON: {e}")
    sys.exit(1)
offers = data if isinstance(data, list) else data.get("offers", [])
target = os.environ["OFFER_ID"]
match = next((o for o in offers if target in (o.get("product_id"), o.get("offer_id"), o.get("id"), o.get("sku"))), None)
if not match:
    print("OFFER_NOT_FOUND")
    sys.exit(1)
url = match.get("checkout_url") or match.get("url") or ""
status = match.get("status", "")
if not match.get("checkout_available", status == "VERIFIED_AVAILABLE") or not url.startswith("https://buy.stripe.com/"):
    print("OFFER_NOT_CHECKOUTABLE")
    sys.exit(1)
print("OFFER_OK", match.get("name", target), match.get("price_nzd", match.get("price", "price not published")), match.get("currency", "nzd"))
print("PAYMENT_LINK_CONFIGURED")
PY
echo "  CATALOG_OK"

echo "[3/3] storefront buy route redirects to Stripe..."
REDIRECT="$(curl -sS -o /dev/null -w '%{http_code}\n%{redirect_url}' "$BASE_URL/buy/$OFFER_ID")" || fail "buy route request failed"
HTTP_CODE="${REDIRECT%%$'\n'*}"
LOCATION="${REDIRECT#*$'\n'}"
[[ "$HTTP_CODE" == "302" ]] || fail "expected HTTP 302, got $HTTP_CODE"
[[ "$LOCATION" == https://buy.stripe.com/* ]] || fail "redirect did not point to Stripe Payment Links"
echo "  STRIPE_REDIRECT_OK $HTTP_CODE"
echo
echo "== PASS: $OFFER_ID is published and routes to its configured Stripe Payment Link =="
echo "This proves checkout hand-off only. It does not prove a completed payment, webhook, entitlement, fulfillment, or revenue."
