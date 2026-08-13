#!/usr/bin/env bash
# BEC-PRIME runtime verification gate.
# Proves, rather than assumes, that a specific offer is live, checkoutable,
# and produces a real Stripe Checkout Session. Exits non-zero on failure.

set -euo pipefail

BASE_URL="${BASE_URL:-https://dreamledger.org}"
OFFER_ID="${1:?Usage: verify_checkout_live.sh <OFFER_ID>}"

fail() { echo "FAIL: $1"; exit 1; }

echo "== BEC-PRIME LIVE VERIFICATION GATE =="
echo "Target: $BASE_URL"
echo "Offer:  $OFFER_ID"
echo

echo "[1/4] healthz..."
HEALTH="$(curl -sf "$BASE_URL/healthz")" || fail "healthz unreachable"
echo "$HEALTH" | python3 -c 'import json,sys; d=json.load(sys.stdin); raise SystemExit(0 if d.get("status")=="ok" else 1)' || fail "service not ok"
echo "  ok"

echo "[2/4] live offer catalog..."
OFFERS="$(curl -sf "$BASE_URL/api/offers")" || fail "offers endpoint unreachable"
OFFER_ID="$OFFER_ID" OFFERS_JSON="$OFFERS" python3 - <<'PY'
import json, os, sys
try:
    data = json.loads(os.environ["OFFERS_JSON"])
except Exception as e:
    print(f"INVALID_OFFER_JSON: {e}")
    sys.exit(1)
offers = data if isinstance(data, list) else data.get("offers", [])
target = os.environ["OFFER_ID"]
match = next((o for o in offers if o.get("offer_id") == target or o.get("id") == target), None)
if not match:
    print("OFFER_NOT_FOUND")
    sys.exit(1)
if not match.get("checkout_available"):
    print("CHECKOUT_NOT_AVAILABLE")
    sys.exit(1)
print("OFFER_OK", match.get("price"), match.get("currency"))
PY
echo "  ok"

echo "[3/4] real Stripe Checkout Session..."
SESSION="$(curl -sf -X POST "$BASE_URL/api/offer-checkout/create" \
  -H "Content-Type: application/json" \
  -d "{\"offer_id\":\"$OFFER_ID\"}")" || fail "checkout-create endpoint failed"
SESSION_JSON="$SESSION" python3 - <<'PY'
import json, os, sys
try:
    data = json.loads(os.environ["SESSION_JSON"])
except Exception as e:
    print(f"INVALID_SESSION_JSON: {e}")
    sys.exit(1)
url = data.get("url", "")
if not url.startswith("https://checkout.stripe.com"):
    print("NOT_A_STRIPE_CHECKOUT_URL")
    sys.exit(1)
print("CHECKOUT_OK", data.get("id", "UNKNOWN"))
print(url)
PY

echo "[4/4] ledger durability (informational)..."
HEALTH_JSON="$HEALTH" python3 - <<'PY'
import json, os
h = json.loads(os.environ["HEALTH_JSON"])
print("  durable_ledger_configured:", h.get("durable_ledger_configured"))
print("  event_count:", h.get("revenue_ledger", {}).get("event_count"))
PY

echo
echo "== PASS: deployed service exposes $OFFER_ID as a live, checkoutable Stripe offer =="
echo "This proves the checkout path, not a completed payment."
echo "Level 1 evidence still requires a completed transaction plus verified webhook."
