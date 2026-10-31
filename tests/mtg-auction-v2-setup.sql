-- Self-contained ephemeral PostgreSQL harness, never run against production.
\set ON_ERROR_STOP on
create role anon nologin;
create role authenticated nologin;
create role service_role bypassrls nologin; -- Supabase service_role bypasses RLS, unlike ordinary authenticated users.
create schema auth;
create table auth.users(id uuid primary key,email_confirmed_at timestamptz);
create function auth.uid() returns uuid stable language sql as
$$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table public.mtg_cards(id uuid primary key);
create table public.mtg_auctions(id uuid primary key,seller_id uuid,status text not null default 'open');
create table public.mtg_bids(id uuid primary key,auction_id uuid,bidder_id uuid);
alter table public.mtg_auctions enable row level security;
alter table public.mtg_bids enable row level security;
insert into auth.users(id) values
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222'),
 ('33333333-3333-4333-8333-333333333333');
update auth.users set email_confirmed_at=now();
\i supabase/migrations/20261031201000_mtg_auction_durable_v2.sql
set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
set role authenticated;
select public.mtg_seller_register_v2();
select public.mtg_inventory_submit_v2('Verified test Commander deck','Near mint',repeat('a',64));
reset role;
set role service_role;
select public.mtg_seller_verify_v2('11111111-1111-4111-8111-111111111111','operator-review-verified');
select public.mtg_inventory_verify_v2((select id from public.mtg_inventory_v2 limit 1),repeat('a',64));
reset role;
set role authenticated;
select public.mtg_auction_submit_v2((select id from public.mtg_inventory_v2 limit 1),1000,100,0,now()+interval '1 day');
reset role;
set role service_role;
select public.mtg_auction_publish_v2((select id from public.mtg_auction_lots_v2 limit 1));
reset role;
do $$ begin
 if (select count(*) from public.mtg_auction_lots_v2 where status='open')<>1 then raise exception 'PUBLISH_FAILED'; end if;
 if (select count(*) from public.mtg_inventory_v2 where status='reserved')<>1 then raise exception 'STOCK_NOT_RESERVED'; end if;
end $$;
