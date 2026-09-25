#!/usr/bin/env bash
# Figure-eight smoke tests — rails only, not revenue.
set -euo pipefail
BASE="${LIVE_URL:-https://dreamledger.org}"
FAIL=0
check() {
  local path="$1" want="$2"
  code=$(curl -sL -o /dev/null -w "%{http_code}" --max-time 25 "$BASE$path" || echo 000)
  if [[ "$code" == "$want" ]]; then
    echo "OK  $want $path"
  else
    echo "FAIL got $code want $want $path"
    FAIL=1
  fi
}
check_buy() {
  local path="$1"
  final=$(curl -sL -o /dev/null -w "%{url_effective}" --max-time 30 "$BASE$path" || true)
  if echo "$final" | grep -qi stripe; then
    echo "OK  buy→stripe $path"
  else
    echo "FAIL buy not stripe $path → $final"
    FAIL=1
  fi
}
echo "=== figure-eight smoke $BASE ==="
check "/" 200
check "/login" 200
check "/register" 200
check "/avatar.html" 200
check "/billboard" 200
check "/api/offers" 200
check_buy "/buy/DREAMLEDGER-BILLBOARD-FOUNDING-001"
check_buy "/buy/COMMANDER-DECK-DIAGNOSTIC-001"
if curl -sL "$BASE/" | grep -Eiq 'fossil|settlement spine|gauntlet|elohim|AGENT_BUS|verified_external|CUBE Silo'; then
  echo "FAIL public HTML still has internal language"
  FAIL=1
else
  echo "OK  no obvious internal language on home"
fi
echo "=== revenue claim: none (smoke ≠ paid session) ==="
exit $FAIL
