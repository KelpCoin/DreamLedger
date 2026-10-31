#!/usr/bin/env bash
# Run after baseline + adversarial gauntlet on disposable PostgreSQL only.
set -euo pipefail
export PGHOST=127.0.0.1 PGPORT=5432 PGUSER=postgres PGDATABASE=postgres PGPASSWORD=postgres
sql(){ psql -X -v ON_ERROR_STOP=1 -At -c "$1"; }
seller="11111111-1111-4111-8111-111111111111"
buyer="22222222-2222-4222-8222-222222222222"
hash="$(printf 'b%.0s' {1..64})"
# A second verified fixture is created; no real funds, accounts or uploaded photos.
sql "set role service_role;insert into public.mtg_auction_evidence_v2(owner_id,sha256,storage_key,content_type,byte_size) values('$seller','$hash','$seller/$hash.jpg','image/jpeg',1024);" >/dev/null
sql "set request.jwt.claim.sub='$seller';set role authenticated;select public.mtg_inventory_submit_v2('Lock wait regression physical card','Near mint','$hash');" >/dev/null
inventory="$(sql "select id from public.mtg_inventory_v2 where evidence_sha256='$hash'")"
sql "set role service_role;select public.mtg_inventory_verify_v2('$inventory','$hash');" >/dev/null
lot="$(sql "set request.jwt.claim.sub='$seller';set role authenticated;select public.mtg_auction_submit_v2('$inventory',1000,100,0,now()+interval '1 day');" | tail -n 1)"
sql "set role service_role;select public.mtg_auction_publish_v2('$lot');" >/dev/null
# An expired auction cannot accept a bid, even if the request started before
# expiry but blocked on another connection's row lock.
sql "update public.mtg_auction_lots_v2 set ends_at=clock_timestamp()+interval '2 seconds' where id='$lot';" >/dev/null
temp="$(mktemp -d)";trap 'rm -rf "$temp"' EXIT
(
 psql -X -v ON_ERROR_STOP=1 -c "begin;select id from public.mtg_auction_lots_v2 where id='$lot' for update;select pg_sleep(4);commit;" >"$temp/lock.txt" 2>&1
) & pid=$!
sleep 0.5
if sql "set request.jwt.claim.sub='$buyer';set role authenticated;select public.mtg_auction_bid_v2('$lot',1000,'44444444-4444-4444-8444-444444444444');" >"$temp/late.txt" 2>&1;then
 echo "FAIL: expired bid accepted after lock wait";cat "$temp/late.txt";wait "$pid";exit 1
fi
wait "$pid"
grep -q "BIDDING_CLOSED" "$temp/late.txt" || { echo "Expected explicit BIDDING_CLOSED, got:";cat "$temp/late.txt";exit 1; }
if [ "$(sql "select count(*) from public.mtg_auction_bids_v2 where auction_id='$lot'")" != 0 ];then echo "EXPIRED_BID_PERSISTED";exit 1;fi
# Simulate a near-close real bid; extension must commit with the bid row.
sql "update public.mtg_auction_lots_v2 set ends_at=clock_timestamp()+interval '30 seconds' where id='$lot';" >/dev/null
sql "set request.jwt.claim.sub='$buyer';set role authenticated;select public.mtg_auction_bid_v2('$lot',1000,'55555555-5555-4555-8555-555555555555');" >/dev/null
sql "do \$\$ begin
 if not exists(select 1 from public.mtg_auction_lots_v2
 where id='$lot' and high_bidder='$buyer' and high_bid_cents=1000 and ends_at>=clock_timestamp()+interval '100 seconds')
 then raise exception 'ANTI_SNIPING_NOT_ATOMIC'; end if;
 if (select count(*) from public.mtg_auction_bids_v2 where auction_id='$lot')<>1
 then raise exception 'ACCEPTED_BID_LOG_MISMATCH'; end if;
end \$\$;" >/dev/null
if sql "set role service_role;select public.mtg_auction_close_v2('$lot');" >"$temp/early.txt" 2>&1;then
 echo "CLOSED_BEFORE_EXTENDED_DEADLINE";exit 1
fi
grep -q 'AUCTION_NOT_DUE' "$temp/early.txt" || { cat "$temp/early.txt";exit 1; }
echo "MTG_AUCTION_LOCK_DEADLINE_PASS: late locked-out bids rejected; anti-snipe and accepted bid atomic; early close refused"
