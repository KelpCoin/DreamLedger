#!/usr/bin/env bash
set -euo pipefail
export PGHOST=127.0.0.1 PGPORT=5432 PGUSER=postgres PGDATABASE=postgres PGPASSWORD=postgres
psql -X -v ON_ERROR_STOP=1 -f tests/mtg-auction-v2-setup.sql >/dev/null
lot="$(psql -XAt -c 'select id from public.mtg_auction_lots_v2 limit 1')"
[ -n "$lot" ] || exit 1
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
(
 psql -X -v ON_ERROR_STOP=1 -c "set role authenticated;set request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';select public.mtg_auction_bid_v2('$lot',1000,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');" >"$tmp/a" 2>&1
) & pa=$!
(
 psql -X -v ON_ERROR_STOP=1 -c "set role authenticated;set request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';select public.mtg_auction_bid_v2('$lot',1000,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');" >"$tmp/b" 2>&1
) & pb=$!
ra=0;rb=0;wait "$pa" || ra=$?;wait "$pb" || rb=$?
if ! { [ "$ra" -eq 0 ] && [ "$rb" -ne 0 ]; } && ! { [ "$rb" -eq 0 ] && [ "$ra" -ne 0 ]; }; then
 echo "CONCURRENT_BID_FENCE_FAILED";cat "$tmp/a" "$tmp/b";exit 1
fi
psql -X -v ON_ERROR_STOP=1 -c "
do \$\$ begin
if (select count(*) from public.mtg_auction_bids_v2)<>1 then raise exception 'DOUBLE_ACCEPTED'; end if;
if (select high_bid_cents from public.mtg_auction_lots_v2 limit 1)<>1000 then raise exception 'HIGH_BID_MISMATCH'; end if;
end \$\$;" >/dev/null
winner="$(psql -XAt -c "select bidder_id from public.mtg_auction_bids_v2 limit 1")"
retry="$(psql -XAt -c "select request_id from public.mtg_auction_bids_v2 limit 1")"
psql -X -v ON_ERROR_STOP=1 -c "set role authenticated;set request.jwt.claim.sub='$winner';select public.mtg_auction_bid_v2('$lot',1000,'$retry');" | grep -q idempotent
if psql -X -v ON_ERROR_STOP=1 -c "set role authenticated;set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';select public.mtg_auction_bid_v2('$lot',2000,'cccccccc-cccc-4ccc-8ccc-cccccccccccc');" >/dev/null 2>&1; then
 echo "SELLER_SELF_BID_NOT_BLOCKED";exit 1
fi
if psql -X -v ON_ERROR_STOP=1 -c "set role authenticated;insert into public.mtg_auction_bids_v2(auction_id,bidder_id,request_id,amount_cents) values('$lot','$winner','dddddddd-dddd-4ddd-8ddd-dddddddddddd',9999);" >/dev/null 2>&1;then
 echo "DIRECT_BID_INSERT_NOT_BLOCKED";exit 1
fi
psql -X -v ON_ERROR_STOP=1 -c "update public.mtg_auction_lots_v2 set ends_at=now()-interval '1 second' where id='$lot';" >/dev/null
psql -X -v ON_ERROR_STOP=1 -c "set role service_role;select public.mtg_auction_close_v2('$lot');" >/dev/null
order="$(psql -XAt -c "select id from public.mtg_auction_orders_v2 where auction_id='$lot'")"
[ -n "$order" ] || { echo "WINNER_ORDER_MISSING";exit 1; }
psql -X -v ON_ERROR_STOP=1 -c "set role service_role;select public.mtg_auction_bind_session_v2('$order','cs_test_MTGTEST1234');" >/dev/null
if psql -X -v ON_ERROR_STOP=1 -c "set role service_role;select public.mtg_auction_reconcile_v2('evt_wrongMTG1','checkout.session.completed','cs_test_MTGTEST1234',999,'nzd',repeat('c',64),'pi_MTGTEST1234');" >/dev/null 2>&1;then
 echo "WRONG_AMOUNT_EVENT_ACKED";exit 1
fi
[ "$(psql -XAt -c "select count(*) from public.mtg_auction_external_v2 where stripe_event_id='evt_wrongMTG1'")" = 0 ] || { echo "WRONG_AMOUNT_EVENT_PERMANENTLY_HELD";exit 1; }
psql -X -v ON_ERROR_STOP=1 -c "set role service_role;select public.mtg_auction_reconcile_v2('evt_paidMTG1','checkout.session.completed','cs_test_MTGTEST1234',1000,'nzd',repeat('d',64),'pi_MTGTEST1234');" | grep -q applied
psql -X -v ON_ERROR_STOP=1 -c "set role service_role;select public.mtg_auction_reconcile_v2('evt_paidMTG1','checkout.session.completed','cs_test_MTGTEST1234',1000,'nzd',repeat('d',64),'pi_MTGTEST1234');" | grep -q idempotent
psql -X -v ON_ERROR_STOP=1 -c "set role authenticated;set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';select public.mtg_auction_ship_v2('$order',repeat('e',64));" >/dev/null
psql -X -v ON_ERROR_STOP=1 -c "set role authenticated;set request.jwt.claim.sub='$winner';select public.mtg_auction_deliver_v2('$order');" >/dev/null
if psql -X -v ON_ERROR_STOP=1 -c "set role service_role;select public.mtg_auction_refund_reconcile_v2('evt_wrongRefund1','pi_MTGTEST1234',999,'nzd',repeat('0',64));" >/dev/null 2>&1;then
 echo "PARTIAL_REFUND_MISMATCH_ACKED";exit 1
fi
[ "$(psql -XAt -c "select count(*) from public.mtg_auction_external_v2 where stripe_event_id='evt_wrongRefund1'")" = 0 ] || { echo "PARTIAL_REFUND_PERMANENTLY_HELD";exit 1; }
psql -X -v ON_ERROR_STOP=1 -c "set role service_role;select public.mtg_auction_refund_reconcile_v2('evt_refundMTG1','pi_MTGTEST1234',1000,'nzd',repeat('f',64));" | grep -q applied
psql -X -v ON_ERROR_STOP=1 -c "
do \$\$ declare unbalanced integer;bad_hash integer;begin
select count(*) into unbalanced from
(select journal_id,sum(case when side='debit' then amount_cents else -amount_cents end) b
from public.mtg_auction_postings_v2 group by journal_id
having sum(case when side='debit' then amount_cents else -amount_cents end)<>0)x;
if unbalanced<>0 then raise exception 'LEDGER_UNBALANCED'; end if;
select count(*) into bad_hash from public.mtg_auction_events_v2 e
where e.event_sha256<>encode(pg_catalog.sha256(pg_catalog.convert_to(e.previous_hash||e.auction_id::text||e.sequence::text||e.event_type||e.facts::text,'UTF8')),'hex');
if bad_hash<>0 then raise exception 'HASH_INVALID'; end if;
if (select status from public.mtg_auction_orders_v2 limit 1)<>'refunded' then raise exception 'REFUND_MISMATCH';end if;
if (select count(*) from public.mtg_auction_external_v2)<>2 then raise exception 'EVENT_REPLAY';end if;
end \$\$;" >/dev/null
node - <<'NODE'
const a=require('./BEC-PRIME/auction-engine.js');
for(const f of [()=>a.createAuction({silo:'mtg',title:'fake'}),()=>a.placeBid('x','fake',1)]){
 let blocked=false;try{f()}catch(e){blocked=/AUCTION_V1_DISABLED/.test(e.message)}
 if(!blocked)throw Error('LEGACY_BID_GATE_OPEN');
}
if(a.listAuctions('mtg').length||a.getAuction('AUC-MTG-FETCHLAND-001'))throw Error('FAKE_LOTS_VISIBLE');
console.log('Legacy unsafe auctions closed.');
NODE
echo "MTG_V2_DB_CONTRACT_PASS: concurrency, seller isolation, replay, inventory, payment, refund, audit hash and balanced postings"
