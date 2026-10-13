-- Auction primitive for Trade Me-style timed listings, with human-authorized bids.
begin;
create table if not exists public.marketplace_auctions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null unique references public.marketplace_listings(id),
  seller_party_id uuid not null references public.marketplace_parties(id),
  starting_price_minor bigint not null check (starting_price_minor>=0),
  reserve_price_minor bigint check (reserve_price_minor is null or reserve_price_minor>=0),
  buy_now_price_minor bigint check (buy_now_price_minor is null or buy_now_price_minor>=starting_price_minor),
  minimum_increment_minor bigint not null default 100 check (minimum_increment_minor>0),
  currency char(3) not null default 'NZD',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  anti_sniping_seconds integer not null default 120 check (anti_sniping_seconds between 0 and 900),
  highest_bid_id uuid,
  status text not null default 'pending_review' check (status in ('pending_review','scheduled','live','ended','awarded','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at>starts_at)
);
create table if not exists public.marketplace_bids (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.marketplace_auctions(id),
  bidder_party_id uuid not null references public.marketplace_parties(id),
  amount_minor bigint not null check (amount_minor>=0),
  currency char(3) not null,
  idempotency_key text not null unique,
  status text not null default 'placed' check (status in ('placed','outbid','winning','won','invalid')),
  created_at timestamptz not null default now()
);
alter table public.marketplace_auctions add constraint marketplace_auction_highest_bid_fk foreign key(highest_bid_id) references public.marketplace_bids(id) deferrable initially deferred;
create index if not exists marketplace_auctions_live_idx on public.marketplace_auctions(status,ends_at);
create index if not exists marketplace_bids_highest_idx on public.marketplace_bids(auction_id,amount_minor desc,created_at asc);
alter table public.marketplace_auctions enable row level security;
alter table public.marketplace_bids enable row level security;
revoke all on public.marketplace_auctions,public.marketplace_bids from anon,authenticated;
grant select,insert,update,delete on public.marketplace_auctions,public.marketplace_bids to service_role;

create or replace function public.marketplace_schedule_auction(p_idempotency_key text,p_seller_party_id uuid,p_listing_id uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare listing public.marketplace_listings%rowtype; prior public.marketplace_auctions%rowtype; item public.marketplace_auctions%rowtype; start_at timestamptz; end_at timestamptz; start_price bigint; reserve bigint; buy_now bigint; increment bigint;
begin
  perform pg_advisory_xact_lock(hashtext(p_idempotency_key));
  select * into prior from public.marketplace_auctions where listing_id=p_listing_id;
  if found then return jsonb_build_object('auction_id',prior.id,'state',prior.status,'duplicate',true); end if;
  select * into listing from public.marketplace_listings where id=p_listing_id and seller_party_id=p_seller_party_id and status in ('draft','pending_review');
  if not found then raise exception 'seller-owned draft or pending-review listing required'; end if;
  if listing.pricing_model<>'auction' then raise exception 'listing must use auction pricing_model'; end if;
  start_at:=(p_payload->>'starts_at')::timestamptz; end_at:=(p_payload->>'ends_at')::timestamptz;
  if start_at<=now() or end_at<=start_at or end_at>start_at+interval '30 days' then raise exception 'auction dates must be future-dated and no longer than 30 days'; end if;
  start_price:=coalesce(nullif(p_payload->>'starting_price_minor','')::bigint,listing.price_minor,0);
  reserve:=nullif(p_payload->>'reserve_price_minor','')::bigint;
  buy_now:=nullif(p_payload->>'buy_now_price_minor','')::bigint;
  increment:=coalesce(nullif(p_payload->>'minimum_increment_minor','')::bigint,100);
  if start_price<0 or increment<1 or (reserve is not null and reserve<start_price) or (buy_now is not null and buy_now<start_price) then raise exception 'invalid auction pricing'; end if;
  insert into public.marketplace_auctions(listing_id,seller_party_id,starting_price_minor,reserve_price_minor,buy_now_price_minor,minimum_increment_minor,currency,starts_at,ends_at,anti_sniping_seconds,status)
  values(listing.id,p_seller_party_id,start_price,reserve,buy_now,increment,upper(coalesce(p_payload->>'currency',listing.currency)),start_at,end_at,least(greatest(coalesce(nullif(p_payload->>'anti_sniping_seconds','')::integer,120),0),900),'pending_review') returning * into item;
  perform public.marketplace_append_ledger_event(p_idempotency_key,'AUCTION_SUBMITTED','auction',item.id,'business',p_seller_party_id::text,'OBSERVED',jsonb_build_object('listing_id',listing.id,'starts_at',start_at,'ends_at',end_at,'starting_price_minor',start_price,'reserve_price_minor',reserve,'currency',item.currency));
  return jsonb_build_object('auction_id',item.id,'state','pending_review','duplicate',false);
end; $$;

create or replace function public.marketplace_public_auctions(p_limit integer default 30)
returns setof jsonb language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object('auction_id',a.id,'listing_id',l.id,'title',l.title,'description',l.description,'category',l.category,'starting_price_minor',a.starting_price_minor,'reserve_price_minor',a.reserve_price_minor,'buy_now_price_minor',a.buy_now_price_minor,'minimum_increment_minor',a.minimum_increment_minor,'currency',a.currency,'starts_at',a.starts_at,'ends_at',a.ends_at,'anti_sniping_seconds',a.anti_sniping_seconds,'status',case when a.starts_at<=now() and a.ends_at>now() then 'live' else a.status end,'current_bid_minor',b.amount_minor,'bid_count',(select count(*) from public.marketplace_bids bx where bx.auction_id=a.id and bx.status in ('placed','winning','won')))
  from public.marketplace_auctions a join public.marketplace_listings l on l.id=a.listing_id join public.marketplace_parties p on p.id=a.seller_party_id left join public.marketplace_bids b on b.id=a.highest_bid_id
  where l.status='published' and p.status='active' and a.status in ('scheduled','live') and a.ends_at>now()
  order by a.ends_at asc limit least(greatest(coalesce(p_limit,30),1),100);
$$;

create or replace function public.marketplace_place_bid(p_idempotency_key text,p_auction_id uuid,p_bidder_party_id uuid,p_amount_minor bigint,p_currency char(3),p_authorization jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare auction public.marketplace_auctions%rowtype; bidder public.marketplace_parties%rowtype; current_bid public.marketplace_bids%rowtype; new_bid public.marketplace_bids%rowtype; minimum bigint; next_end timestamptz;
begin
  perform pg_advisory_xact_lock(hashtext(p_idempotency_key));
  select * into new_bid from public.marketplace_bids where idempotency_key=p_idempotency_key;
  if found then return jsonb_build_object('bid_id',new_bid.id,'state',new_bid.status,'duplicate',true); end if;
  if coalesce(p_authorization->>'confirmed','false')<>'true' or coalesce(length(trim(p_authorization->>'authorized_by')),0)<3 then raise exception 'explicit human bid authorization required'; end if;
  select * into auction from public.marketplace_auctions where id=p_auction_id for update;
  if not found or auction.status not in ('scheduled','live') or auction.starts_at>now() or auction.ends_at<=now() then raise exception 'auction is not live'; end if;
  select * into bidder from public.marketplace_parties where id=p_bidder_party_id and status='active';
  if not found then raise exception 'active bidder party required'; end if;
  if bidder.id=auction.seller_party_id then raise exception 'seller cannot bid on own auction'; end if;
  if upper(p_currency)<>upper(auction.currency) or p_amount_minor<0 then raise exception 'bid currency mismatch or invalid amount'; end if;
  if auction.highest_bid_id is null then minimum:=auction.starting_price_minor; else select * into current_bid from public.marketplace_bids where id=auction.highest_bid_id; minimum:=current_bid.amount_minor+auction.minimum_increment_minor; end if;
  if p_amount_minor<minimum then raise exception 'bid is below minimum increment'; end if;
  if auction.buy_now_price_minor is not null and p_amount_minor>=auction.buy_now_price_minor then raise exception 'use the separately authorized buy-now path; bid cannot silently trigger a purchase'; end if;
  insert into public.marketplace_bids(auction_id,bidder_party_id,amount_minor,currency,idempotency_key,status)
  values(auction.id,bidder.id,p_amount_minor,upper(p_currency),p_idempotency_key,'winning') returning * into new_bid;
  if auction.highest_bid_id is not null then update public.marketplace_bids set status='outbid' where id=auction.highest_bid_id; end if;
  next_end:=auction.ends_at;
  if auction.anti_sniping_seconds>0 and auction.ends_at-now()<=make_interval(secs=>auction.anti_sniping_seconds) then next_end:=now()+make_interval(secs=>auction.anti_sniping_seconds); end if;
  update public.marketplace_auctions set highest_bid_id=new_bid.id,ends_at=next_end,status='live',updated_at=now() where id=auction.id;
  perform public.marketplace_append_ledger_event(p_idempotency_key,'AUCTION_BID_PLACED','auction',auction.id,'human',bidder.id::text,'AUTHORIZED',jsonb_build_object('bid_id',new_bid.id,'amount_minor',p_amount_minor,'currency',upper(p_currency),'authorized_by',left(p_authorization->>'authorized_by',160),'ends_at',next_end));
  return jsonb_build_object('auction_id',auction.id,'bid_id',new_bid.id,'state','winning','amount_minor',p_amount_minor,'currency',upper(p_currency),'ends_at',next_end,'duplicate',false);
end; $$;

create or replace function public.marketplace_close_auction(p_auction_id uuid,p_closed_by text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare auction public.marketplace_auctions%rowtype; bid public.marketplace_bids%rowtype; listing public.marketplace_listings%rowtype; terms jsonb; agreement public.marketplace_agreements%rowtype; ord public.marketplace_orders%rowtype; result_state text;
begin
  select * into auction from public.marketplace_auctions where id=p_auction_id for update;
  if not found then raise exception 'auction not found'; end if;
  if auction.status in ('awarded','ended') then return jsonb_build_object('auction_id',auction.id,'state',auction.status,'duplicate',true); end if;
  if auction.status not in ('scheduled','live') then raise exception 'auction is not eligible to close'; end if;
  if auction.ends_at>now() then raise exception 'auction cannot close before end time'; end if;
  select * into listing from public.marketplace_listings where id=auction.listing_id;
  if auction.highest_bid_id is null then update public.marketplace_auctions set status='ended',updated_at=now() where id=auction.id; result_state:='ended';
  else
    select * into bid from public.marketplace_bids where id=auction.highest_bid_id for update;
    if auction.reserve_price_minor is not null and bid.amount_minor<auction.reserve_price_minor then update public.marketplace_auctions set status='ended',updated_at=now() where id=auction.id; update public.marketplace_bids set status='outbid' where id=bid.id; result_state:='reserve_not_met';
    else
      terms:=jsonb_build_object('auction_id',auction.id,'listing_id',listing.id,'title',listing.title,'amount_minor',bid.amount_minor,'currency',auction.currency,'bid_id',bid.id);
      insert into public.marketplace_agreements(offer_id,auction_id,buyer_party_id,seller_party_id,version,terms,terms_hash,buyer_accepted_at,seller_accepted_at,human_authorization,status)
      values(null,auction.id,bid.bidder_party_id,auction.seller_party_id,1,terms,encode(digest(convert_to(terms::text,'UTF8'),'sha256'),'hex'),now(),now(),jsonb_build_object('confirmed',true,'authorized_by',bid.bidder_party_id::text,'source','human_authorized_auction_bid'),'accepted')
      returning * into agreement;
      insert into public.marketplace_orders(agreement_id,buyer_party_id,seller_party_id,amount_minor,currency,payment_state,fulfillment_state,idempotency_key,state)
      values(agreement.id,bid.bidder_party_id,auction.seller_party_id,bid.amount_minor,auction.currency,'UNPAID','NOT_STARTED','auction-win:'||auction.id::text,'CREATED') returning * into ord;
      update public.marketplace_bids set status='won' where id=bid.id;
      update public.marketplace_auctions set status='awarded',updated_at=now() where id=auction.id;
      result_state:='awarded';
      perform public.marketplace_append_ledger_event('auction-closed:'||auction.id::text,'AUCTION_AWARDED','auction',auction.id,'system',left(coalesce(p_closed_by,'system'),160),'AUTHORIZED',jsonb_build_object('order_id',ord.id,'winner_party_id',bid.bidder_party_id,'winning_bid_minor',bid.amount_minor,'currency',auction.currency));
    end if;
  end if;
  if result_state<>'awarded' then perform public.marketplace_append_ledger_event('auction-closed:'||auction.id::text,'AUCTION_ENDED','auction',auction.id,'system',left(coalesce(p_closed_by,'system'),160),'OBSERVED',jsonb_build_object('result',result_state,'reserve_price_minor',auction.reserve_price_minor)); end if;
  return jsonb_build_object('auction_id',auction.id,'state',result_state,'order_id',ord.id,'winner_party_id',bid.bidder_party_id);
end; $$;

-- The winning auction order's agreement references the auction terms rather than a supplier offer.
alter table public.marketplace_agreements alter column offer_id drop not null;
alter table public.marketplace_agreements add column if not exists auction_id uuid references public.marketplace_auctions(id);

revoke all on function public.marketplace_schedule_auction(text,uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.marketplace_public_auctions(integer) from public,anon,authenticated;
revoke all on function public.marketplace_place_bid(text,uuid,uuid,bigint,char,jsonb) from public,anon,authenticated;
revoke all on function public.marketplace_close_auction(uuid,text) from public,anon,authenticated;
grant execute on function public.marketplace_schedule_auction(text,uuid,uuid,jsonb) to service_role;
grant execute on function public.marketplace_public_auctions(integer) to service_role;
grant execute on function public.marketplace_place_bid(text,uuid,uuid,bigint,char,jsonb) to service_role;
grant execute on function public.marketplace_close_auction(uuid,text) to service_role;
commit;
