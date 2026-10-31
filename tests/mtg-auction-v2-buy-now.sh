#!/usr/bin/env bash
# Runs after the original isolated suite on ephemeral GitHub Actions PostgreSQL only.
set -euo pipefail
export PGHOST=127.0.0.1 PGPORT=5432 PGUSER=postgres PGDATABASE=postgres PGPASSWORD=postgres
sql(){ psql -X -v ON_ERROR_STOP=1 -At -c "$1"; }
seller='11111111-1111-4111-8111-111111111111'
buyer1='22222222-2222-4222-8222-222222222222'
buyer2='33333333-3333-4333-8333-333333333333'
h="$(printf '%064d' 0 | tr 0 b)"
sql "set role service_role;
 insert into public.mtg_auction_evidence_v2(owner_id,sha256,storage_key,content_type,byte_size)
 values('$seller','$h','$seller/$h.jpg','image/jpeg',1024);" >/dev/null
sql "set request.jwt.claim.sub='$seller';set role authenticated;
 select public.mtg_inventory_submit_v2('Buy now test deck','Near mint','$h');" >/dev/null
inventory="$(sql "select id from public.mtg_inventory_v2 where evidence_sha256='$h'")"
[ -n "$inventory" ] || { echo "BUY_NOW_INVENTORY_MISSING";exit 1; }
sql "set role service_role;select public.mtg_inventory_verify_v2('$inventory','$h');" >/dev/null
sql "set request.jwt.claim.sub='$seller';set role authenticated;
 select public.mtg_auction_submit_v2('$inventory',1000,100,0,now()+interval '1 day');" >/dev/null
lot="$(sql "select id from public.mtg_auction_lots_v2 where inventory_id='$inventory'")"
[ -n "$lot" ] || { echo "BUY_NOW_DRAFT_MISSING";exit 1; }
sql "set request.jwt.claim.sub='$seller';set role authenticated;
 select public.mtg_auction_set_buy_now_v2('$lot',1900);" >/dev/null
sql "set role service_role;select public.mtg_auction_publish_v2('$lot');" >/dev/null
[ "$(sql "select buy_now_cents from public.mtg_auction_lots_v2 where id='$lot'")" = 1900 ] || exit 1
tmp="$(mktemp -d)";trap 'rm -rf "$tmp"' EXIT
(
 sql "set request.jwt.claim.sub='$buyer1';set role authenticated;
 select public.mtg_auction_buy_now_v2('$lot');" >"$tmp/a" 2>&1
) & a=$!
(
 sql "set request.jwt.claim.sub='$buyer2';set role authenticated;
 select public.mtg_auction_buy_now_v2('$lot');" >"$tmp/b" 2>&1
) & b=$!
ra=0;rb=0;wait "$a"||ra=$?;wait "$b"||rb=$?
if ! { [ "$ra" -eq 0 ] && [ "$rb" -ne 0 ]; } && ! { [ "$rb" -eq 0 ] && [ "$ra" -ne 0 ]; }; then
 echo "BUY_NOW_RACE_ACCEPTED_WRONG";cat "$tmp/a" "$tmp/b";exit 1
fi
buyer="$(sql "select buyer_id from public.mtg_auction_orders_v2 where auction_id='$lot'")"
[ -n "$buyer" ] || exit 1
[ "$(sql "select count(*) from public.mtg_auction_orders_v2 where auction_id='$lot'")" = 1 ] ||
 { echo "BUY_NOW_DUPLICATE_ORDER";exit 1; }
[ "$(sql "select status from public.mtg_auction_lots_v2 where id='$lot'")" = awaiting_payment ] ||
 { echo "BUY_NOW_WRONG_STATUS";exit 1; }
[ "$(sql "select amount_cents from public.mtg_auction_orders_v2 where auction_id='$lot'")" = 1900 ] ||
 { echo "BUY_NOW_PRICE_TAMPERING";exit 1; }
sql "set request.jwt.claim.sub='$buyer';set role authenticated;
 select public.mtg_auction_buy_now_v2('$lot');" | grep -q idempotent
if sql "set request.jwt.claim.sub='$seller';set role authenticated;
 select public.mtg_auction_set_buy_now_v2('$lot',2200);" >/dev/null 2>&1;then
 echo "PUBLISHED_BUY_NOW_EDIT_ALLOWED";exit 1
fi
if sql "set request.jwt.claim.sub='$buyer2';set role authenticated;
 select public.mtg_auction_bid_v2('$lot',2000,'cccccccc-cccc-4ccc-8ccc-cccccccccccc');" >/dev/null 2>&1;then
 echo "BID_ACCEPTED_AFTER_BUY_NOW";exit 1
fi
echo "MTG_BUY_NOW_PASS: atomic concurrent buyers, seller draft, idempotence, no post-sale bids, exact price, one order"
