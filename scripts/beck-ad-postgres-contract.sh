#!/usr/bin/env bash
set -euo pipefail
# EXCLUSIVELY for ephemeral local PostgreSQL CI. Never run on a customer database.
if [[ "$PGHOST" != "127.0.0.1" || "$PGPORT" != "5432" || "$PGDATABASE" != "beck_ad_ci" ]]; then
  echo "REFUSE: not the ephemeral BECK CI Postgres" >&2; exit 3
fi
export PGUSER=postgres
export PGPASSWORD=postgres
psql -X -v ON_ERROR_STOP=1 -q <<'SQL'
DO $$
BEGIN
 IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
 IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
 IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END $$;
SQL
psql -X -v ON_ERROR_STOP=1 -q -f supabase/migrations/202611010001_beck_ad_reservations.sql
psql -X -v ON_ERROR_STOP=1 -q -f supabase/migrations/202611010002_beck_ad_checkout_binding.sql
psql -X -v ON_ERROR_STOP=1 -q -c "INSERT INTO public.beck_ad_canvases(exhaust,silo,canvas,width,height,inventory_owner,booking_enabled) VALUES('dreamledger','ads','nz_board',1000,1000,'CI_SYNTHETIC',true)"
reserve() {
 psql -X -v ON_ERROR_STOP=1 -q -t -A -c "SELECT (public.beck_ad_reserve_tile('dreamledger','ads','nz_board','$1',0,0,100,100,1000,1000,'2026-11-01T00:00:00Z','3000-01-01T00:00:00Z',5000,'NZD',60)).reservation_id;"
}
reserve ci-race-left-0001 > /tmp/beck-ad-race-left.log 2>&1 &
left=$!
reserve ci-race-right-0002 > /tmp/beck-ad-race-right.log 2>&1 &
right=$!
s1=0
s2=0
if wait "$left"; then s1=1; fi
if wait "$right"; then s2=1; fi
cat /tmp/beck-ad-race-left.log /tmp/beck-ad-race-right.log
[[ "$((s1+s2))" == "1" ]] || { echo "FAIL: simultaneous claims both accepted/rejected"; exit 1; }
q() { psql -X -v ON_ERROR_STOP=1 -q -t -A -c "$1"; }
[[ "$(q 'SELECT count(*) FROM public.beck_ad_reservations')" == "1" ]] || exit 1
key="$(q 'SELECT idempotency_key FROM public.beck_ad_reservations LIMIT 1')"
reserve "$key" >/tmp/beck-ad-idempotency.log
[[ "$(q 'SELECT count(*) FROM public.beck_ad_reservations')" == "1" ]] || exit 1
id="$(q 'SELECT reservation_id FROM public.beck_ad_reservations LIMIT 1')"
if q "SELECT public.beck_ad_record_paid('$id'::uuid,'cs_live_ci_one','evt_ci_one','pi_ci_one',5000,'NZD',true,repeat('a',64))" >/dev/null 2>&1; then
 echo "FAIL: unbound checkout accepted"; exit 1
fi
q "SELECT (public.beck_ad_bind_checkout('$id'::uuid,'cs_live_ci_one',clock_timestamp()+interval '30 minutes','Synthetic title','https://example.invalid/',repeat('a',64))).reservation_id"
# Simulate a delayed webhook after original hold expiry. A bound session must
# remain excluded from another sale, yet a verified paid receipt must succeed.
q "UPDATE public.beck_ad_reservations SET hold_expires_at=clock_timestamp()-interval '2 minutes' WHERE reservation_id='$id'"
if reserve ci-late-resale-0001 >/tmp/beck-ad-resell.log 2>&1; then
 echo "FAIL: expired bound checkout was sold twice";exit 1
fi
if q "SELECT public.beck_ad_record_paid('$id'::uuid,'cs_live_ci_one','evt_ci_one','pi_ci_one',5000,'NZD',true,repeat('b',64))" >/dev/null 2>&1; then
 echo "FAIL: wrong creative SHA accepted"; exit 1
fi
q "SELECT (public.beck_ad_record_paid('$id'::uuid,'cs_live_ci_one','evt_ci_one','pi_ci_one',5000,'NZD',true,repeat('a',64))).status"
q "SELECT (public.beck_ad_record_paid('$id'::uuid,'cs_live_ci_one','evt_ci_one','pi_ci_one',5000,'NZD',true,repeat('a',64))).status"
[[ "$(q "SELECT status FROM public.beck_ad_reservations WHERE reservation_id='$id'")" == "PAID" ]] || exit 1
[[ "$(q "SELECT status FROM public.beck_ad_payment_receipts WHERE reservation_id='$id'")" == "PAID_PENDING_CREATIVE_REVIEW" ]] || exit 1
[[ "$(q 'SELECT count(*) FROM public.beck_ad_payment_receipts')" == "1" ]] || exit 1
echo "PASS: two SQL migrations, concurrency, no resale of expired bound Checkout, idempotency, and paid creative review."
