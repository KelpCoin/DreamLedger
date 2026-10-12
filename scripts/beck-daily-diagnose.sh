#!/usr/bin/env bash
# DreamLedger / BECK read-only daily host and service snapshot.
# Does not install packages, load models, restart services, contact Stripe APIs, or write to Supabase.
set -u

STAMP="$(date -Is 2>/dev/null || date)"
LM_BASE="${BECK_LMSTUDIO_BASE:-http://127.0.0.1:1234/v1}"
SITE_URL="${BECK_OFFER_URL:-https://dreamledger.org/agent-delivery-proof-audit.html}"
SUPABASE_URL="${SUPABASE_URL:-https://wbwgroygjeyukkspnqiy.supabase.co}"

section() { printf '\n=== %s ===\n' "$1"; }
http_status() {
  local url="$1"
  if command -v curl >/dev/null 2>&1; then
    curl -sS -L -o /dev/null -w '%{http_code}' --connect-timeout 4 --max-time 12 "$url" 2>/dev/null || printf '000'
  else
    printf 'NO_CURL'
  fi
}

printf 'BECK_DAILY_DIAGNOSTIC=1\nCAPTURED_LOCAL=%s\nHOST=%s\nREAD_ONLY=1\n' "$STAMP" "$(hostname 2>/dev/null || printf unknown)"

section "OS / KERNEL"
uname -a 2>/dev/null || true
if [ -r /etc/os-release ]; then sed -n '1,8p' /etc/os-release; fi

section "DISK SPACE"
df -hT 2>/dev/null || df -h 2>/dev/null || true

section "MEMORY"
if command -v free >/dev/null 2>&1; then free -h; else cat /proc/meminfo 2>/dev/null | head -n 12; fi

section "NVIDIA GPU / DRIVER SNAPSHOT"
if command -v nvidia-smi >/dev/null 2>&1; then
  nvidia-smi --query-gpu=name,driver_version,memory.total,memory.used,memory.free,utilization.gpu --format=csv,noheader 2>&1 || true
else
  printf 'NVIDIA_SMI=UNAVAILABLE (GPU acceleration not verified)\n'
fi

section "LM STUDIO API"
MODELS_STATUS="$(http_status "$LM_BASE/models")"
printf 'LMSTUDIO_MODELS_HTTP=%s\n' "$MODELS_STATUS"
if [ "$MODELS_STATUS" = "200" ]; then
  if command -v python3 >/dev/null 2>&1 && command -v curl >/dev/null 2>&1; then
    curl -sS --connect-timeout 4 --max-time 12 "$LM_BASE/models" 2>/dev/null |
      python3 -c 'import json,sys; d=json.load(sys.stdin); [print("MODEL_ID="+str(x.get("id",""))) for x in d.get("data",[])]' 2>/dev/null ||
      printf 'MODEL_LIST_PARSE=FAILED\n'
  else
    printf 'MODEL_LIST=API_REACHABLE_BUT_PYTHON3_OR_CURL_MISSING\n'
  fi
else
  printf 'LMSTUDIO_STATE=NOT_VERIFIED; start LM Studio only after reviewing this snapshot\n'
fi

section "PUBLIC OFFER PAGE (HTTP ONLY, NOT CHECKOUT OR PAYMENT PROOF)"
printf 'OFFER_URL=%s\n' "$SITE_URL"
printf 'OFFER_PAGE_HTTP=%s\n' "$(http_status "$SITE_URL")"

section "SUPABASE DATA API REACHABILITY (NO AUTHENTICATED DB HEALTH CLAIM)"
printf 'SUPABASE_PROJECT_REF=wbwgroygjeyukkspnqiy\n'
SB_STATUS="$(http_status "${SUPABASE_URL%/}/rest/v1/")"
printf 'SUPABASE_REST_HTTP=%s\n' "$SB_STATUS"
case "$SB_STATUS" in
  200) printf 'SUPABASE_RESULT=HTTP_REACHABLE_ONLY; authenticated DB/RPC health still unproven\n' ;;
  401|403) printf 'SUPABASE_RESULT=GATEWAY_REACHABLE_AUTH_REQUIRED; this does NOT prove Postgres or RPC health\n' ;;
  5??) printf 'SUPABASE_RESULT=SERVER_ERROR; automated fulfillment remains BLOCKED\n' ;;
  000|NO_CURL) printf 'SUPABASE_RESULT=UNREACHABLE_OR_CLIENT_MISSING; automated fulfillment remains BLOCKED\n' ;;
  *) printf 'SUPABASE_RESULT=HTTP_%s; data-plane health remains UNPROVEN\n' "$SB_STATUS" ;;
esac

section "LOCAL REPOSITORY / 777 GATE DISCOVERY"
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [ -n "$ROOT" ]; then
  printf 'REPO_ROOT=%s\n' "$ROOT"
  printf 'GIT_BRANCH=%s\n' "$(git -C "$ROOT" branch --show-current 2>/dev/null || printf unknown)"
  printf 'GIT_STATUS_SHORT_BEGIN\n'
  git -C "$ROOT" status --short 2>/dev/null | head -n 80 || true
  printf 'GIT_STATUS_SHORT_END\n'
  if [ -f "$ROOT/scripts/777_compounding_gate.py" ]; then
    printf '777_GATE_PRESENT=1\n'
    printf '777_GATE_POLICY=run only after an admissible artifact or exact current-run no-op receipt exists; this diagnostic does not execute it\n'
  else
    printf '777_GATE_PRESENT=0\n'
  fi
else
  printf 'REPO_ROOT=NOT_FOUND (run from a DreamLedger checkout for 777 recon)\n'
fi

printf '\nDIAGNOSTIC_COMPLETE=1\n'
printf 'TRUTH_NOTE=HTTP reachability, model listing, or a local artifact is not proof of inference readiness, database health, settled revenue, or fulfillment.\n'
