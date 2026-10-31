-- MTG v2: approval-gated durable auction settlement spine.
-- This migration is additive and does NOT activate public auctions or charge buyers.
-- Requires prior MTG/auth migrations and pgcrypto.
create schema if not exists mtg_private;
revoke all on schema mtg_private from public, anon, authenticated;

-- Disable unauthenticated/nonatomic legacy auction writes, including direct bids.
-- Historic v1 rows are not approved v2 inventory: fail closed without deleting records.
update public.mtg_auctions set status='draft' where status='open';
revoke insert,update,delete on public.mtg_cards from anon,authenticated;
drop policy if exists "mtg cards owner write" on public.mtg_cards;
revoke insert, update, delete on public.mtg_auctions from anon, authenticated;
revoke insert, update, delete on public.mtg_bids from anon, authenticated;
drop policy if exists "mtg auctions seller write" on public.mtg_auctions;
drop policy if exists "mtg bids bidder insert" on public.mtg_bids;
drop policy if exists "mtg bids public read" on public.mtg_bids;
create policy "mtg bids participants read" on public.mtg_bids for select to authenticated
using (bidder_id=(select auth.uid()) or exists
(select 1 from public.mtg_auctions a where a.id=auction_id and a.seller_id=(select auth.uid())));

create table if not exists public.mtg_seller_profiles_v2(
 user_id uuid primary key references auth.users(id) on delete restrict,
 status text not null default 'pending' check(status in('pending','verified','suspended')),
 verification_ref text,
 verified_at timestamptz,
 created_at timestamptz not null default now()
);
create table if not exists public.mtg_inventory_v2(
 id uuid primary key default gen_random_uuid(),
 seller_id uuid not null references public.mtg_seller_profiles_v2(user_id),
 title text not null check(length(trim(title)) between 3 and 180),
 condition text not null check(length(trim(condition)) between 2 and 100),
 quantity integer not null default 1 check(quantity=1),
 evidence_sha256 text not null check(evidence_sha256 ~ '^[0-9a-f]{64}$'),
 status text not null default 'pending' check(status in('pending','verified','reserved','sold','held')),
 verified_at timestamptz,
 created_at timestamptz not null default now()
);
create table if not exists public.mtg_auction_lots_v2(
 id uuid primary key default gen_random_uuid(),
 inventory_id uuid not null references public.mtg_inventory_v2(id),
 seller_id uuid not null references public.mtg_seller_profiles_v2(user_id),
 title text not null,
 currency text not null default 'NZD' check(currency='NZD'),
 start_cents bigint not null check(start_cents>=100),
 increment_cents bigint not null default 100 check(increment_cents>=100),
 reserve_cents bigint not null default 0 check(reserve_cents>=0),
 high_bid_cents bigint not null default 0 check(high_bid_cents>=0),
 high_bidder uuid references auth.users(id),
 status text not null default 'draft' check(status in
 ('draft','open','unsold','awaiting_payment','paid','shipped','delivered','disputed','refunded','cancelled')),
 starts_at timestamptz,
 ends_at timestamptz not null,
 original_ends_at timestamptz,
 version bigint not null default 0,
 created_at timestamptz not null default now(),
 check(high_bid_cents=0 or high_bidder is not null)
);
create unique index if not exists mtg_v2_one_lot_per_inventory on public.mtg_auction_lots_v2(inventory_id);
create index if not exists mtg_v2_open_due on public.mtg_auction_lots_v2(status,ends_at);
create table if not exists public.mtg_auction_bids_v2(
 id uuid primary key default gen_random_uuid(),
 auction_id uuid not null references public.mtg_auction_lots_v2(id),
 bidder_id uuid not null references auth.users(id),
 request_id uuid not null,
 amount_cents bigint not null check(amount_cents>0),
 received_at timestamptz not null default clock_timestamp(),
 unique(auction_id,bidder_id,request_id)
);
create index if not exists mtg_v2_bid_rank on public.mtg_auction_bids_v2(auction_id,amount_cents desc,received_at);
create table if not exists public.mtg_auction_orders_v2(
 id uuid primary key default gen_random_uuid(),
 auction_id uuid not null unique references public.mtg_auction_lots_v2(id),
 buyer_id uuid not null references auth.users(id),
 seller_id uuid not null references auth.users(id),
 amount_cents bigint not null check(amount_cents>=100),
 currency text not null default 'NZD' check(currency='NZD'),
 status text not null default 'awaiting_checkout' check(status in('awaiting_checkout','paid','shipped','delivered','disputed','refunded')),
 stripe_session text unique,
 stripe_payment_intent text unique,
 paid_at timestamptz,
 shipped_at timestamptz,
 shipment_proof_sha256 text check(shipment_proof_sha256 is null or shipment_proof_sha256 ~ '^[0-9a-f]{64}$'),
 delivered_at timestamptz,
 disputed_at timestamptz,
 refunded_at timestamptz,
 created_at timestamptz not null default now()
);
create table if not exists public.mtg_auction_events_v2(
 id uuid primary key default gen_random_uuid(),
 auction_id uuid not null references public.mtg_auction_lots_v2(id),
 sequence bigint not null,
 event_type text not null,
 actor_id uuid,
 facts jsonb not null default '{}'::jsonb,
 previous_hash text not null,
 event_sha256 text not null,
 created_at timestamptz not null default clock_timestamp(),
 unique(auction_id,sequence)
);
create table if not exists public.mtg_auction_external_v2(
 stripe_event_id text primary key,
 event_type text not null,
 stripe_session text,
 payload_sha256 text not null check(payload_sha256 ~ '^[0-9a-f]{64}$'),
 order_id uuid references public.mtg_auction_orders_v2(id),
 outcome text not null check(outcome in('applied','held')),
 received_at timestamptz not null default now()
);
create table if not exists public.mtg_auction_postings_v2(
 id uuid primary key default gen_random_uuid(),
 journal_id text not null,
 account text not null check(account in('stripe_clearing','unallocated_liability','refunds_pending')),
 side text not null check(side in('debit','credit')),
 amount_cents bigint not null check(amount_cents>0),
 currency text not null default 'NZD' check(currency='NZD'),
 created_at timestamptz not null default now(),
 unique(journal_id,account,side)
);
do $$ declare t text; begin
 foreach t in array array['mtg_seller_profiles_v2','mtg_inventory_v2','mtg_auction_lots_v2',
 'mtg_auction_bids_v2','mtg_auction_orders_v2','mtg_auction_events_v2',
 'mtg_auction_external_v2','mtg_auction_postings_v2'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public, anon, authenticated',t);
 end loop;
end $$;
grant select,insert,update,delete on public.mtg_seller_profiles_v2,public.mtg_inventory_v2,
 public.mtg_auction_lots_v2,public.mtg_auction_bids_v2,public.mtg_auction_orders_v2,
 public.mtg_auction_events_v2,public.mtg_auction_external_v2,public.mtg_auction_postings_v2
 to service_role;
grant select(id,title,currency,start_cents,increment_cents,high_bid_cents,status,starts_at,ends_at,version) on public.mtg_auction_lots_v2 to anon,authenticated;
grant select on public.mtg_auction_bids_v2,public.mtg_auction_orders_v2,
 public.mtg_inventory_v2,public.mtg_seller_profiles_v2 to authenticated;
create policy "mtg v2 visible lots" on public.mtg_auction_lots_v2 for select to anon,authenticated
 using (status<>'draft' or seller_id=(select auth.uid()));
create policy "mtg v2 bidder owns bids" on public.mtg_auction_bids_v2 for select to authenticated
 using (bidder_id=(select auth.uid()) or exists(select 1 from public.mtg_auction_lots_v2 l
 where l.id=auction_id and l.seller_id=(select auth.uid())));
create policy "mtg v2 order parties" on public.mtg_auction_orders_v2 for select to authenticated
 using (buyer_id=(select auth.uid()) or seller_id=(select auth.uid()));
create policy "mtg v2 inventory owner" on public.mtg_inventory_v2 for select to authenticated
 using (seller_id=(select auth.uid()));
create policy "mtg v2 seller owner" on public.mtg_seller_profiles_v2 for select to authenticated
 using (user_id=(select auth.uid()));

-- Audit chain written inside the same database transaction as each auction mutation.
create or replace function mtg_private.event(p_auction uuid,p_type text,p_actor uuid,p_facts jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare n bigint; prev text; h text;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_auction::text,0));
 select sequence,event_sha256 into n,prev from public.mtg_auction_events_v2
 where auction_id=p_auction order by sequence desc limit 1;
 n:=coalesce(n,0)+1; prev:=coalesce(prev,repeat('0',64));
 h:=encode(pg_catalog.sha256(pg_catalog.convert_to(prev||p_auction::text||n::text||p_type||p_facts::text,'UTF8')),'hex');
 insert into public.mtg_auction_events_v2(auction_id,sequence,event_type,actor_id,facts,previous_hash,event_sha256)
 values(p_auction,n,p_type,p_actor,p_facts,prev,h);
end $$;
revoke all on function mtg_private.event(uuid,text,uuid,jsonb) from public,anon,authenticated;

create or replace function public.mtg_seller_register_v2()
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := auth.uid(); s text;
begin
 if u is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 insert into public.mtg_seller_profiles_v2(user_id) values(u) on conflict do nothing;
 select status into s from public.mtg_seller_profiles_v2 where user_id=u;
 return jsonb_build_object('seller_id',u,'status',s);
end $$;
create or replace function public.mtg_inventory_submit_v2(p_title text,p_condition text,p_evidence_sha256 text)
returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); result uuid;
begin
 if u is null then raise exception 'AUTH_REQUIRED'; end if;
 if not exists(select 1 from public.mtg_seller_profiles_v2 where user_id=u and status<>'suspended')
 then raise exception 'SELLER_ACCOUNT_REQUIRED'; end if;
 if length(trim(coalesce(p_title,''))) not between 3 and 180 or
 length(trim(coalesce(p_condition,''))) not between 2 and 100 or
 coalesce(p_evidence_sha256,'') !~ '^[0-9a-f]{64}$' then raise exception 'INVALID_INVENTORY_EVIDENCE'; end if;
 insert into public.mtg_inventory_v2(seller_id,title,condition,evidence_sha256)
 values(u,trim(p_title),trim(p_condition),p_evidence_sha256) returning id into result;
 return result;
end $$;
create or replace function public.mtg_auction_submit_v2(
 p_inventory uuid,p_start_cents bigint,p_increment_cents bigint,p_reserve_cents bigint,p_ends_at timestamptz)
returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); v public.mtg_inventory_v2%rowtype; aid uuid;
begin
 if u is null then raise exception 'AUTH_REQUIRED'; end if;
 select * into v from public.mtg_inventory_v2 where id=p_inventory and seller_id=u for update;
 if not found or v.status not in ('pending','verified') then raise exception 'INVENTORY_UNAVAILABLE'; end if;
 if p_start_cents<100 or p_increment_cents<100 or p_reserve_cents<0 or p_ends_at not between now()+interval '15 minutes' and now()+interval '30 days'
 then raise exception 'INVALID_AUCTION_TERMS'; end if;
 insert into public.mtg_auction_lots_v2(inventory_id,seller_id,title,start_cents,increment_cents,reserve_cents,ends_at)
 values(v.id,u,v.title,p_start_cents,p_increment_cents,p_reserve_cents,p_ends_at) returning id into aid;
 perform mtg_private.event(aid,'seller_submitted',u,jsonb_build_object('inventory_id',v.id,'start_cents',p_start_cents));
 return aid;
end $$;

-- Service-only evidence gates. Verification is never writable by sellers.
create or replace function public.mtg_seller_verify_v2(p_seller uuid,p_ref text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if length(trim(coalesce(p_ref,'')))<12 then raise exception 'VERIFICATION_EVIDENCE_REQUIRED'; end if;
 update public.mtg_seller_profiles_v2 set status='verified',verification_ref=p_ref,verified_at=now() where user_id=p_seller;
 if not found then raise exception 'SELLER_NOT_FOUND'; end if;
end $$;
create or replace function public.mtg_inventory_verify_v2(p_inventory uuid,p_sha text)
returns void language plpgsql security definer set search_path='' as $$
declare i public.mtg_inventory_v2%rowtype;
begin
  select * into i from public.mtg_inventory_v2 where id=p_inventory for update;
 if not found or i.status<>'pending' or i.evidence_sha256<>p_sha or
 not exists(select 1 from public.mtg_seller_profiles_v2 where user_id=i.seller_id and status='verified')
 then raise exception 'INVENTORY_NOT_VERIFIABLE'; end if;
 update public.mtg_inventory_v2 set status='verified',verified_at=now() where id=i.id;
end $$;
create or replace function public.mtg_auction_publish_v2(p_auction uuid)
returns void language plpgsql security definer set search_path='' as $$
declare l public.mtg_auction_lots_v2%rowtype;
begin
  select * into l from public.mtg_auction_lots_v2 where id=p_auction for update;
 if not found or l.status<>'draft' or l.ends_at<=now()+interval '5 minutes'
 or not exists(select 1 from public.mtg_inventory_v2 i join public.mtg_seller_profiles_v2 s on i.seller_id=s.user_id
 where i.id=l.inventory_id and i.seller_id=l.seller_id and i.status='verified' and s.status='verified')
 then raise exception 'AUCTION_NOT_PUBLISHABLE'; end if;
 update public.mtg_inventory_v2 set status='reserved' where id=l.inventory_id and status='verified';
 if not found then raise exception 'INVENTORY_RESERVATION_FAILED'; end if;
 update public.mtg_auction_lots_v2 set status='open',starts_at=now(),original_ends_at=ends_at,version=version+1 where id=l.id;
 perform mtg_private.event(l.id,'auction_published',null,jsonb_build_object('inventory_id',l.inventory_id));
end $$;
create or replace function public.mtg_auction_bid_v2(p_auction uuid,p_amount_cents bigint,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); l public.mtg_auction_lots_v2%rowtype; oldbid public.mtg_auction_bids_v2%rowtype;
 b uuid; floor_price bigint; t timestamptz:=clock_timestamp();
begin
 if u is null then raise exception 'AUTH_REQUIRED'; end if;
 if not exists(select 1 from auth.users where id=u and email_confirmed_at is not null)
 then raise exception 'VERIFIED_BUYER_EMAIL_REQUIRED'; end if;
 if p_request_id is null or p_amount_cents is null or p_amount_cents>100000000000 then raise exception 'INVALID_BID'; end if;
 select * into l from public.mtg_auction_lots_v2 where id=p_auction for update;
 if not found then raise exception 'AUCTION_NOT_FOUND'; end if;
 select * into oldbid from public.mtg_auction_bids_v2
 where auction_id=l.id and bidder_id=u and request_id=p_request_id;
 if found then
  if oldbid.amount_cents<>p_amount_cents then raise exception 'IDEMPOTENCY_KEY_REUSED'; end if;
  return jsonb_build_object('bid_id',oldbid.id,'accepted_cents',oldbid.amount_cents,'idempotent',true);
 end if;
 if l.status<>'open' or l.starts_at>t or l.ends_at<=t then raise exception 'BIDDING_CLOSED'; end if;
 if l.seller_id=u then raise exception 'SELF_BIDDING_FORBIDDEN'; end if;
 if not exists(select 1 from public.mtg_inventory_v2 where id=l.inventory_id and status='reserved')
 or not exists(select 1 from public.mtg_seller_profiles_v2 where user_id=l.seller_id and status='verified')
 then raise exception 'SELLER_OR_STOCK_UNVERIFIED'; end if;
 floor_price:=case when l.high_bid_cents=0 then l.start_cents else l.high_bid_cents+l.increment_cents end;
 if p_amount_cents<floor_price then raise exception 'BID_TOO_LOW'; end if;
 insert into public.mtg_auction_bids_v2(auction_id,bidder_id,request_id,amount_cents)
 values(l.id,u,p_request_id,p_amount_cents) returning id into b;
 update public.mtg_auction_lots_v2 set high_bid_cents=p_amount_cents,high_bidder=u,version=version+1,
 ends_at=case when ends_at<t+interval '2 minutes' then least(original_ends_at+interval '1 hour',t+interval '2 minutes') else ends_at end
 where id=l.id;
 perform mtg_private.event(l.id,'bid_accepted',u,jsonb_build_object('bid_id',b,'amount_cents',p_amount_cents));
 return jsonb_build_object('bid_id',b,'accepted_cents',p_amount_cents,'idempotent',false);
end $$;
create or replace function public.mtg_auction_close_v2(p_auction uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare l public.mtg_auction_lots_v2%rowtype; o uuid;
begin
  select * into l from public.mtg_auction_lots_v2 where id=p_auction for update;
 if not found then raise exception 'AUCTION_NOT_FOUND'; end if;
 if l.status in ('unsold','awaiting_payment','paid','shipped','delivered','disputed','refunded') then
  select id into o from public.mtg_auction_orders_v2 where auction_id=l.id;
  return jsonb_build_object('status',l.status,'order_id',o,'idempotent',true);
 end if;
 if l.status<>'open' or l.ends_at>clock_timestamp() then raise exception 'AUCTION_NOT_DUE'; end if;
 if l.high_bidder is null or l.high_bid_cents<l.reserve_cents then
  update public.mtg_auction_lots_v2 set status='unsold',version=version+1 where id=l.id;
  update public.mtg_inventory_v2 set status='verified' where id=l.inventory_id and status='reserved';
  perform mtg_private.event(l.id,'closed_unsold',null,'{}'::jsonb);
  return jsonb_build_object('status','unsold');
 end if;
 insert into public.mtg_auction_orders_v2(auction_id,buyer_id,seller_id,amount_cents)
 values(l.id,l.high_bidder,l.seller_id,l.high_bid_cents) returning id into o;
 update public.mtg_auction_lots_v2 set status='awaiting_payment',version=version+1 where id=l.id;
 perform mtg_private.event(l.id,'winner_selected',l.high_bidder,jsonb_build_object('order_id',o,'cents',l.high_bid_cents));
 return jsonb_build_object('status','awaiting_payment','order_id',o);
end $$;
create or replace function public.mtg_auction_bind_session_v2(p_order uuid,p_session text)
returns void language plpgsql security definer set search_path='' as $$
declare o public.mtg_auction_orders_v2%rowtype;
begin
  if coalesce(p_session,'') !~ '^cs_(test_|live_)[A-Za-z0-9]+$' then raise exception 'INVALID_SESSION_ID'; end if;
 select * into o from public.mtg_auction_orders_v2 where id=p_order for update;
 if not found or o.status<>'awaiting_checkout' or (o.stripe_session is not null and o.stripe_session<>p_session)
 then raise exception 'CHECKOUT_BINDING_CONFLICT'; end if;
 update public.mtg_auction_orders_v2 set stripe_session=p_session where id=p_order;
 perform mtg_private.event(o.auction_id,'checkout_bound',null,jsonb_build_object('session',p_session));
end $$;
create or replace function public.mtg_auction_reconcile_v2(
 p_event_id text,p_event_type text,p_session text,p_amount_cents bigint,p_currency text,p_payload_sha256 text,
 p_payment_intent text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.mtg_auction_orders_v2%rowtype; l public.mtg_auction_lots_v2%rowtype; outcome text:='held';
begin
  if p_event_id !~ '^evt_[A-Za-z0-9_]+$' or p_payload_sha256 !~ '^[0-9a-f]{64}$'
 then raise exception 'INVALID_EXTERNAL_EVENT'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_event_id,1));
 if exists(select 1 from public.mtg_auction_external_v2 where stripe_event_id=p_event_id) then
  if exists(select 1 from public.mtg_auction_external_v2 where stripe_event_id=p_event_id and payload_sha256<>p_payload_sha256)
  then raise exception 'EVENT_ID_PAYLOAD_CONFLICT'; end if;
  return jsonb_build_object('idempotent',true,'outcome',(select e.outcome from public.mtg_auction_external_v2 e where e.stripe_event_id=p_event_id));
 end if;
 select * into o from public.mtg_auction_orders_v2 where stripe_session=p_session for update;
 if found and p_event_type in ('checkout.session.completed','checkout.session.async_payment_succeeded') and o.status='awaiting_checkout' and
 p_currency='nzd' and p_amount_cents=o.amount_cents and p_payment_intent like 'pi_%' then
  update public.mtg_auction_orders_v2 set status='paid',paid_at=now(),stripe_payment_intent=p_payment_intent where id=o.id;
  update public.mtg_auction_lots_v2 set status='paid',version=version+1 where id=o.auction_id;
  update public.mtg_inventory_v2 set status='sold' where id=(select inventory_id from public.mtg_auction_lots_v2 where id=o.auction_id);
  insert into public.mtg_auction_postings_v2(journal_id,account,side,amount_cents) values
   (p_event_id,'stripe_clearing','debit',o.amount_cents),
   (p_event_id,'unallocated_liability','credit',o.amount_cents);
  perform mtg_private.event(o.auction_id,'stripe_paid',null,jsonb_build_object('event_id',p_event_id,'amount_cents',o.amount_cents));
  outcome:='applied';
 end if;
 insert into public.mtg_auction_external_v2(stripe_event_id,event_type,stripe_session,payload_sha256,order_id,outcome)
 values(p_event_id,p_event_type,p_session,p_payload_sha256,case when found then o.id else null end,outcome);
 return jsonb_build_object('idempotent',false,'outcome',outcome);
end $$;
create or replace function public.mtg_auction_ship_v2(p_order uuid,p_proof_sha256 text)
returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); o public.mtg_auction_orders_v2%rowtype;
begin
 if u is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_proof_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'SHIPMENT_PROOF_REQUIRED'; end if;
 select * into o from public.mtg_auction_orders_v2 where id=p_order for update;
 if not found or o.seller_id<>u or o.status<>'paid' then raise exception 'SHIPMENT_NOT_ALLOWED'; end if;
 update public.mtg_auction_orders_v2 set status='shipped',shipped_at=now(),shipment_proof_sha256=p_proof_sha256 where id=o.id;
 update public.mtg_auction_lots_v2 set status='shipped',version=version+1 where id=o.auction_id;
 perform mtg_private.event(o.auction_id,'shipment_declared',u,jsonb_build_object('proof_sha256',p_proof_sha256));
end $$;
create or replace function public.mtg_auction_deliver_v2(p_order uuid)
returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); o public.mtg_auction_orders_v2%rowtype;
begin
 if u is null then raise exception 'AUTH_REQUIRED'; end if;
 select * into o from public.mtg_auction_orders_v2 where id=p_order for update;
 if not found or o.buyer_id<>u or o.status<>'shipped' then raise exception 'DELIVERY_NOT_ALLOWED'; end if;
 update public.mtg_auction_orders_v2 set status='delivered',delivered_at=now() where id=o.id;
 update public.mtg_auction_lots_v2 set status='delivered',version=version+1 where id=o.auction_id;
 perform mtg_private.event(o.auction_id,'buyer_confirmed_delivery',u,'{}'::jsonb);
end $$;
create or replace function public.mtg_auction_dispute_v2(p_order uuid,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); o public.mtg_auction_orders_v2%rowtype;
begin
 if u is null then raise exception 'AUTH_REQUIRED'; end if;
 select * into o from public.mtg_auction_orders_v2 where id=p_order for update;
 if not found or o.buyer_id<>u or o.status not in('paid','shipped') or now()>o.paid_at+interval '14 days'
 then raise exception 'DISPUTE_NOT_ALLOWED'; end if;
 if length(trim(coalesce(p_reason,'')))<10 then raise exception 'DISPUTE_REASON_REQUIRED'; end if;
 update public.mtg_auction_orders_v2 set status='disputed',disputed_at=now() where id=o.id;
 update public.mtg_auction_lots_v2 set status='disputed',version=version+1 where id=o.auction_id;
 perform mtg_private.event(o.auction_id,'buyer_dispute',u,jsonb_build_object('reason',left(p_reason,1000)));
end $$;


-- Explicit function ACLs; never widen existing unrelated functions.
do $tag$ declare f text; begin
 foreach f in array array[
  'mtg_seller_register_v2()','mtg_inventory_submit_v2(text,text,text)',
  'mtg_auction_submit_v2(uuid,bigint,bigint,bigint,timestamptz)',
  'mtg_seller_verify_v2(uuid,text)','mtg_inventory_verify_v2(uuid,text)',
  'mtg_auction_publish_v2(uuid)','mtg_auction_bid_v2(uuid,bigint,uuid)',
  'mtg_auction_close_v2(uuid)','mtg_auction_bind_session_v2(uuid,text)',
  'mtg_auction_reconcile_v2(text,text,text,bigint,text,text,text)',
  'mtg_auction_ship_v2(uuid,text)','mtg_auction_deliver_v2(uuid)',
  'mtg_auction_dispute_v2(uuid,text)'
 ] loop execute 'revoke all on function public.'||f||' from public,anon,authenticated'; end loop;
end $tag$;
grant execute on function public.mtg_seller_register_v2() to authenticated;
grant execute on function public.mtg_inventory_submit_v2(text,text,text) to authenticated;
grant execute on function public.mtg_auction_submit_v2(uuid,bigint,bigint,bigint,timestamptz) to authenticated;
grant execute on function public.mtg_auction_bid_v2(uuid,bigint,uuid) to authenticated;
grant execute on function public.mtg_auction_ship_v2(uuid,text) to authenticated;
grant execute on function public.mtg_auction_deliver_v2(uuid) to authenticated;
grant execute on function public.mtg_auction_dispute_v2(uuid,text) to authenticated;
grant execute on function public.mtg_seller_verify_v2(uuid,text) to service_role;
grant execute on function public.mtg_inventory_verify_v2(uuid,text) to service_role;
grant execute on function public.mtg_auction_publish_v2(uuid) to service_role;
grant execute on function public.mtg_auction_close_v2(uuid) to service_role;
grant execute on function public.mtg_auction_bind_session_v2(uuid,text) to service_role;
grant execute on function public.mtg_auction_reconcile_v2(text,text,text,bigint,text,text,text) to service_role;

-- Verified refunds: only full refunds are automatically accounted; partial refunds are held for review.
create or replace function public.mtg_auction_refund_reconcile_v2(
 p_event_id text,p_payment_intent text,p_refunded_cents bigint,p_currency text,p_payload_sha256 text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.mtg_auction_orders_v2%rowtype; outcome text:='held';
begin
 if p_event_id !~ '^evt_[A-Za-z0-9_]+$' or p_payment_intent !~ '^pi_[A-Za-z0-9_]+$'
 or p_payload_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'INVALID_REFUND_EVENT'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_event_id,1));
 if exists(select 1 from public.mtg_auction_external_v2 where stripe_event_id=p_event_id) then
  if exists(select 1 from public.mtg_auction_external_v2 where stripe_event_id=p_event_id and payload_sha256<>p_payload_sha256)
  then raise exception 'EVENT_ID_PAYLOAD_CONFLICT'; end if;
  return jsonb_build_object('idempotent',true,'outcome',(select e.outcome from public.mtg_auction_external_v2 e where e.stripe_event_id=p_event_id));
 end if;
 select * into o from public.mtg_auction_orders_v2 where stripe_payment_intent=p_payment_intent for update;
 if found and o.status in ('paid','shipped','delivered','disputed') and p_refunded_cents=o.amount_cents and p_currency='nzd' then
  update public.mtg_auction_orders_v2 set status='refunded',refunded_at=now() where id=o.id;
  update public.mtg_auction_lots_v2 set status='refunded',version=version+1 where id=o.auction_id;
  insert into public.mtg_auction_postings_v2(journal_id,account,side,amount_cents) values
   (p_event_id,'unallocated_liability','debit',o.amount_cents),
   (p_event_id,'stripe_clearing','credit',o.amount_cents);
  perform mtg_private.event(o.auction_id,'stripe_refunded',null,jsonb_build_object('event_id',p_event_id,'amount_cents',o.amount_cents));
  outcome:='applied';
 end if;
 insert into public.mtg_auction_external_v2(stripe_event_id,event_type,payload_sha256,order_id,outcome)
 values(p_event_id,'charge.refunded',p_payload_sha256,case when found then o.id else null end,outcome);
 return jsonb_build_object('idempotent',false,'outcome',outcome);
end $$;
revoke all on function public.mtg_auction_refund_reconcile_v2(text,text,bigint,text,text) from public,anon,authenticated;
grant execute on function public.mtg_auction_refund_reconcile_v2(text,text,bigint,text,text) to service_role;
