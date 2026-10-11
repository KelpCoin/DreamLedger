#!/usr/bin/env bash
# Read-only service checks plus a local daily workspace. Does not write to Supabase or run sales actions.
set -u
umask 077
ROOT="${BEC_DAILY_ROOT:-$HOME/bec-daily}"
DAY="$(date +%F)"
OUT="$ROOT/$DAY"
mkdir -p "$OUT/council" "$OUT/money" "$OUT/777"
LOG="$OUT/bootstrap.log"
exec > >(tee -a "$LOG") 2>&1
LM_BASE="${BECK_LMSTUDIO_BASE:-http://127.0.0.1:1234/v1}"
SB_URL="${SUPABASE_URL:-https://wbwgroygjeyukkspnqiy.supabase.co}"
http_code(){ curl -sS -L -o /dev/null -w '%{http_code}' --connect-timeout 4 --max-time 12 "$1" 2>/dev/null || printf '000'; }
printf 'BECK_DAILY_BOOTSTRAP=1\nDATE=%s\nHOST=%s\nWORKSPACE=%s\n' "$DAY" "$(hostname)" "$OUT"
echo '=== DISK ==='; df -hT 2>/dev/null || df -h
echo '=== MEMORY ==='; free -h 2>/dev/null || head -n 12 /proc/meminfo
echo '=== NVIDIA ==='
if command -v nvidia-smi >/dev/null 2>&1; then nvidia-smi --query-gpu=name,driver_version,memory.total,memory.used,memory.free,utilization.gpu --format=csv,noheader || true; else echo 'GPU_STATUS=UNVERIFIED; nvidia-smi unavailable'; fi
echo '=== LM STUDIO ==='
code="$(http_code "$LM_BASE/models")"
if [ "$code" != 200 ] && command -v lms >/dev/null 2>&1; then
  echo 'LMSTUDIO_START_ATTEMPT=1'; lms server start --port 1234 || true; sleep 2; code="$(http_code "$LM_BASE/models")"
fi
echo "LMSTUDIO_MODELS_HTTP=$code"
if [ "$code" = 200 ]; then curl -sS --max-time 12 "$LM_BASE/models" 2>/dev/null || true; else echo 'LMSTUDIO_STATUS=NOT_READY; model loading is not automatic'; fi
echo; echo '=== PUBLIC OFFER PAGES (HTTP ONLY) ==='
for url in ${BECK_OFFER_URLS:-https://dreamledger.org/agent-delivery-proof-audit.html https://dreamledger.org/billboard.html}; do echo "URL=$url HTTP=$(http_code "$url")"; done
echo '=== SUPABASE GATEWAY (NO AUTH OR WRITES) ==='
sb="$(http_code "${SB_URL%/}/rest/v1/")"; echo "SUPABASE_PROJECT_REF=wbwgroygjeyukkspnqiy"; echo "SUPABASE_REST_HTTP=$sb"
case "$sb" in 200) echo 'SUPABASE_STATUS=GATEWAY_REACHABLE_ONLY; DB/RPC health UNPROVEN';; 401|403) echo 'SUPABASE_STATUS=AUTH_REQUIRED; DB/RPC health UNPROVEN';; 5??|000) echo 'SUPABASE_STATUS=BLOCKED; automated fulfillment BLOCKED';; *) echo "SUPABASE_STATUS=HTTP_$sb; DB/RPC health UNPROVEN";; esac
cat > "$OUT/council/01-scout.txt" <<'EOF'
SCOUT: Find the strongest existing, independently sourced demand signal for one approved DreamLedger offer and one inbound/public action that could improve odds of a sale in 48h. Include URLs and timestamps. Never invent buyers or demand. Return at most five bullets.
EOF
cat > "$OUT/council/02-critic.txt" <<'EOF'
CRITICAL: Challenge Scout claims. Label VERIFIED / UNVERIFIED / CONTRADICTED / STALE. Check buyer intent, evidence quality, price/scope, checkout readiness, support/contact, delivery capacity, and risk. Give practical fixes; never infer DB health from gateway reachability or revenue from internal events.
EOF
cat > "$OUT/council/03-synth.txt" <<'EOF'
SYNTH: Use Scout evidence and Critical review to produce at most seven actions ordered by expected commercial value and low effort. One approved offer, one buyer path. Prefer inbound/public distribution; personal outreach is optional. State proof required and blockers. No architecture work unless it directly blocks sale/fulfillment.
EOF
cat > "$OUT/money/CHECKLIST.md" <<'EOF'
# One-sale checklist
- [ ] Verify one approved offer's live page, price, scope, payment destination, support/contact, and delivery process.
- [ ] Do one feasible commercial action: fix a buyer-facing blocker, improve intake/delivery, or publish a useful sourced public post.
- [ ] Do not promote an offer whose checkout is held or delivery is not ready.
- [ ] For a sale, reconcile settled external payment to the exact order, deliver the work, and retain evidence.
- [ ] If any payment-to-delivery evidence is missing, mark UNVERIFIED.
- [ ] Page views, checkouts, PaymentIntents without settlement proof, model output, and CI are not revenue.
EOF
cat > "$OUT/777/RULES.md" <<'EOF'
# 777 rules
- Use only admissible external signals with source URL and observation time.
- New public pulse HTML must cite sources and state revenue is UNVERIFIED unless proven.
- If no admissible signal exists, use the workflow's exact current-run no-op receipt contract.
- Never fabricate an artifact to make CI green.
- Run scripts/777_compounding_gate.py from the repo only after satisfying its artifact/no-op contract.
- Revenue remains NZ$0 until settlement and fulfillment evidence are reconciled.
EOF
cat > "$OUT/EOD.md" <<EOF
DATE: $DAY
DONE:
BLOCKED:
ARTIFACTS:
REVENUE_VERIFIED_NZD: 0.00
NEXT:
EOF
echo "BOOTSTRAP_COMPLETE=1"; echo "WORKSPACE=$OUT"; echo "LOG=$LOG"
echo 'LIMITS=No model loading, Supabase writes, payment claims, or fulfillment claims. HTTP checks do not prove database health.'
