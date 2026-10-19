#!/bin/sh
set -eu

APP_ROOT="/app"
DATA_ROOT="/var/data"
ENGINE_PID=""
STOREFRONT_PID=""

mkdir -p \
  "$DATA_ROOT/ledger" \
  "$DATA_ROOT/proofs" \
  "$DATA_ROOT/qr" \
  "$DATA_ROOT/dreamiez" \
  "$DATA_ROOT/demand" \
  "$DATA_ROOT/jobs" \
  "$DATA_ROOT/bec-proofs" \
  "$DATA_ROOT/bec-prime-data"

# Keep legacy file-backed runtime records on the mounted volume. Seed only files
# that do not already exist, so image deployments never overwrite live records.
SOURCE_DATA="$APP_ROOT/BEC-PRIME/data"
PERSISTENT_DATA="$DATA_ROOT/bec-prime-data"
if [ -d "$SOURCE_DATA" ] && [ ! -L "$SOURCE_DATA" ]; then
  cp -an "$SOURCE_DATA/." "$PERSISTENT_DATA/" 2>/dev/null || true
  rm -rf "$SOURCE_DATA"
  ln -s "$PERSISTENT_DATA" "$SOURCE_DATA"
elif [ ! -e "$SOURCE_DATA" ]; then
  ln -s "$PERSISTENT_DATA" "$SOURCE_DATA"
fi

export LEDGER_DATA_DIR="$DATA_ROOT/ledger"
export PROOF_DATA_DIR="$DATA_ROOT/proofs"
export FIRST_PAYMENT_PROOF_PATH="$DATA_ROOT/proofs/FIRST_PAYMENT_PROOF.json"
export QR_DATA_DIR="$DATA_ROOT/qr"
export DREAMIEZ_DATA_DIR="$DATA_ROOT/dreamiez"
export DEMAND_RADAR_DATA_DIR="$DATA_ROOT/demand"
export BEC_JOB_QUEUE_DIR="$DATA_ROOT/jobs"
export BEC_PROOF_DIR="$DATA_ROOT/bec-proofs"

cleanup() {
  if [ -n "$STOREFRONT_PID" ]; then kill "$STOREFRONT_PID" 2>/dev/null || true; fi
  if [ -n "$ENGINE_PID" ]; then kill "$ENGINE_PID" 2>/dev/null || true; fi
  if [ -n "$STOREFRONT_PID" ]; then wait "$STOREFRONT_PID" 2>/dev/null || true; fi
  if [ -n "$ENGINE_PID" ]; then wait "$ENGINE_PID" 2>/dev/null || true; fi
}
trap cleanup EXIT INT TERM

# The engine is bound to loopback only. Fly exposes only the storefront port.
(
  cd "$APP_ROOT/BEC-PRIME"
  PORT=3000 HOST=127.0.0.1 node \
    -r ./lib/commercePaymentContractPreload.js \
    -r ./lib/marketplacePreload.js \
    -r ./lib/boundaryRuntimePreload.js \
    -r ./lib/authRuntimePreload.js \
    -r ./lib/mtgRoutePreload.js \
    -r ./lib/publicCheckoutPreload.js \
    -r ./lib/billboardWebhookPreload.js \
    -r ./lib/liveRouteCompatibility.js \
    start.js
) &
ENGINE_PID=$!

# Do not start the public listener until the internal engine answers healthz.
attempt=0
until [ "$attempt" -ge 90 ]; do
  if node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
    break
  fi
  if ! kill -0 "$ENGINE_PID" 2>/dev/null; then
    echo "RENDER_EXIT_BOOT_BLOCKED=ENGINE_PROCESS_EXITED" >&2
    exit 1
  fi
  attempt=$((attempt + 1))
  sleep 1
done
if [ "$attempt" -ge 90 ]; then
  echo "RENDER_EXIT_BOOT_BLOCKED=ENGINE_HEALTH_TIMEOUT" >&2
  exit 1
fi

(
  cd "$APP_ROOT/public"
  PORT=8080 ENGINE_INTERNAL_URL="${ENGINE_INTERNAL_URL:-http://127.0.0.1:3000}" node \
    -r ./discordCommercePreload.js \
    -r ./agentbridge-preload.js \
    -r ./webhook-proxy-preload.js \
    -r ./hypothesisCommercePreload.js \
    -r ./brand-preload.js \
    -r ./qrSurfacePreload.js \
    server.js
) &
STOREFRONT_PID=$!

echo "RENDER_EXIT_RUNTIME=STARTED"
echo "ENGINE_BIND=127.0.0.1:3000"
echo "STOREFRONT_BIND=0.0.0.0:8080"
echo "PERSISTENT_DATA_ROOT=$DATA_ROOT"

# Either process exiting makes the whole machine unhealthy. Do not leave a
# deceptively green storefront running with a dead engine.
while kill -0 "$ENGINE_PID" 2>/dev/null && kill -0 "$STOREFRONT_PID" 2>/dev/null; do
  sleep 2
done
echo "RENDER_EXIT_RUNTIME=BLOCKED_CHILD_PROCESS_EXITED" >&2
exit 1
