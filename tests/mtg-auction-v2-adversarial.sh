#!/usr/bin/env bash
# Runs after the baseline gauntlet against the same disposable PostgreSQL DB.
set -euo pipefail
export PGHOST=127.0.0.1 PGPORT=5432 PGUSER=postgres PGDATABASE=postgres PGPASSWORD=postgres
sql(){ psql -X -v ON_ERROR_STOP=1 -At -c "$1"; }
deny(){
 local label="$1" command="$2" output
 if output="$(sql "$command" 2>&1)";then
  echo "SECURITY_FAILURE_$label: unexpectedly allowed"; exit 1
 fi
 echo "PASS_DENY_$label"
}
aid="$(sql "select id from public.mtg_auction_lots_v2 limit 1")"
oid="$(sql "select id from public.mtg_auction_orders_v2 limit 1")"
[ -n "$aid" ] && [ -n "$oid" ] || { echo "NO_ISOLATED_ORDER";exit 1; }
deny SELLER_APPROVAL "set role authenticated;set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';select public.mtg_seller_verify_v2('11111111-1111-4111-8111-111111111111','FAKE-VERIFICATION');"
deny INVENTORY_APPROVAL "set role authenticated;set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';select public.mtg_inventory_verify_v2((select id from public.mtg_inventory_v2 limit 1),repeat('a',64));"
deny PAYMENT_FORGERY "set role authenticated;insert into public.mtg_auction_postings_v2(journal_id,account,side,amount_cents) values('fabricated','stripe_clearing','debit',100);"
deny DIRECT_ORDER_UPDATE "set role authenticated;update public.mtg_auction_orders_v2 set status='paid' where id='$oid';"
deny BIDDER_ID_EXPOSURE "set role anon;select bidder_id from public.mtg_auction_lots_v2 limit 1;"
deny PRIVATE_EVIDENCE_READ "set role authenticated;set request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';select storage_key from public.mtg_auction_evidence_v2;"
deny REFUND_REPLAY_TAMPERING "set role service_role;select public.mtg_auction_refund_reconcile_v2('evt_refundMTG1','pi_MTGTEST1234',1000,'nzd',repeat('0',64));"
deny PAID_EVENT_REPLAY_TAMPERING "set role service_role;select public.mtg_auction_reconcile_v2('evt_paidMTG1','checkout.session.completed','cs_test_MTGTEST1234',1000,'nzd',repeat('0',64),'pi_MTGTEST1234');"
deny REUSE_INVENTORY "set role authenticated;set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';select public.mtg_auction_submit_v2((select id from public.mtg_inventory_v2 limit 1),1500,100,0,now()+interval '1 day');"
# This implementation deliberately rejects live Stripe sessions even for service_role.
# Check exact error: a generic ORDER_NOT_FOUND would not prove the TEST-only fence.
outcome=""
if outcome="$(sql "set role service_role;select public.mtg_auction_bind_session_v2('00000000-0000-4000-8000-000000000001','cs_live_AuctionLeak123');" 2>&1)"; then
 echo "LIVE_SESSION_BOUND_IN_TEST_MODE";exit 1
fi
if ! printf '%s' "$outcome" | grep -q 'INVALID_SESSION_ID'; then
 echo "LIVE_SESSION_FENCE_NOT_PROVEN";exit 1
fi
if [ "$(sql "select public from storage.buckets where id='mtg-auction-evidence'")" != 'f' ];then echo "PRIVATE_BUCKET_MISCONFIGURED";exit 1;fi
echo "MTG_V2_ADVERSARIAL_PASS: approval, payment, private stock, authorization, replay, bidder privacy and duplicate inventory"
