-- Path A auction MVP: enforce direct seller/buyer contracting and prohibit platform settlement/commission.
-- Sensitive identity records are backend-only. Do not expose these fields through public views or API responses.
begin;

alter table public.dreamledger_auctions
  alter column current_bid type bigint using current_bid::bigint;

alter table public.dreamledger_auctions
  add column if not exists auction_path text not null default 'A',
  add column if not exists seller_id uuid references auth.users(id),
  add column if not exists seller_trader_disclosure boolean not null default false,
  add column if not exists direct_contract_confirmed boolean not null default false,
  add column if not exists platform_receives_proceeds boolean not null default false,
  add column if not exists platform_commission_bps integer not null default 0,
  add column if not exists closed_at timestamptz;

alter table public.dreamledger_auctions
  add constraint dreamledger_auctions_path_a_only
    check (auction_path = 'A') not valid,
  add constraint dreamledger_auctions_no_platform_settlement
    check (platform_receives_proceeds = false) not valid,
  add constraint dreamledger_auctions_no_platform_commission
    check (platform_commission_bps = 0) not valid,
  add constraint dreamledger_auctions_nonnegative_commission
    check (platform_commission_bps >= 0) not valid;

-- Required seller record for online secondhand-auction compliance.
-- DOB/contact details are restricted data and must never be returned by public listing endpoints.
create table if not exists public.auction_seller_compliance_records (
  id uuid primary key default gen_random_uuid(),
  auction_id text not null references public.dreamledger_auctions(id) on delete restrict,
  seller_user_id uuid not null references auth.users(id) on delete restrict,
  full_name text not null check (length(trim(full_name)) > 0),
  date_of_birth date not null,
  contact_phone text not null check (length(trim(contact_phone)) > 0),
  contact_email text not null check (length(trim(contact_email)) > 0),
  online_trading_identity text not null check (length(trim(online_trading_identity)) > 0),
  source_ip inet not null,
  recorded_at timestamptz not null default now(),
  bids_closed_at timestamptz,
  retain_until timestamptz,
  created_at timestamptz not null default now(),
  unique (auction_id, seller_user_id),
  check (retain_until is null or bids_closed_at is not null)
);

create index if not exists auction_seller_compliance_retention_idx
  on public.auction_seller_compliance_records (retain_until)
  where retain_until is not null;

create table if not exists public.auction_bids (
  id uuid primary key default gen_random_uuid(),
  auction_id text not null references public.dreamledger_auctions(id) on delete restrict,
  bidder_user_id uuid not null references auth.users(id) on delete restrict,
  amount_minor bigint not null check (amount_minor > 0),
  created_at timestamptz not null default now(),
  unique (auction_id, bidder_user_id, amount_minor, created_at)
);

create index if not exists auction_bids_auction_amount_idx
  on public.auction_bids (auction_id, amount_minor desc, created_at asc);

alter table public.auction_seller_compliance_records enable row level security;
alter table public.auction_bids enable row level security;

-- Auction state is backend-controlled. Clients may read public listing state, but may not
-- insert/update/delete auctions or mutate current_bid outside the atomic bid RPC.
revoke insert, update, delete, truncate, references, trigger
  on public.dreamledger_auctions from anon, authenticated;
grant select on public.dreamledger_auctions to anon, authenticated;

-- No client-facing policies on the sensitive compliance table.
revoke all on public.auction_seller_compliance_records from anon, authenticated;
grant all on public.auction_seller_compliance_records to service_role;

-- Bidder identity is private. Authenticated clients may read only their own bid rows.
drop policy if exists auction_bids_read_own on public.auction_bids;
create policy auction_bids_read_own on public.auction_bids
  for select to authenticated using (bidder_user_id = (select auth.uid()));
revoke all on public.auction_bids from anon, authenticated;
grant select on public.auction_bids to authenticated;
grant select, insert, update, delete on public.auction_bids to service_role;

create or replace function public.auction_path_a_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.auction_path <> 'A'
     or new.platform_receives_proceeds
     or new.platform_commission_bps <> 0 then
    raise exception 'PATH_A_INVARIANT_VIOLATION: auction MVP cannot receive seller proceeds or charge auction commission'
      using errcode = '23514';
  end if;

  if new.status = 'open' then
    if new.seller_id is null then
      raise exception 'AUCTION_SELLER_REQUIRED';
    end if;
    if not new.seller_trader_disclosure or not new.direct_contract_confirmed then
      raise exception 'AUCTION_DISCLOSURE_AND_DIRECT_CONTRACT_REQUIRED';
    end if;
    if not exists (
      select 1 from public.auction_seller_compliance_records r
      where r.auction_id = new.id and r.seller_user_id = new.seller_id
    ) then
      raise exception 'AUCTION_SELLER_COMPLIANCE_RECORD_REQUIRED';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists dreamledger_auctions_path_a_guard on public.dreamledger_auctions;
create trigger dreamledger_auctions_path_a_guard
  before insert or update of auction_path, seller_id, seller_trader_disclosure,
    direct_contract_confirmed, platform_receives_proceeds, platform_commission_bps, status
  on public.dreamledger_auctions
  for each row execute function public.auction_path_a_guard();

create or replace function public.place_auction_bid(p_auction_id text, p_amount_minor bigint)
returns table (bid_id uuid, accepted_amount_minor bigint, auction_ends_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_auction public.dreamledger_auctions%rowtype;
  v_minimum bigint;
  v_bid_id uuid;
begin
  if v_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '28000';
  end if;
  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'BID_AMOUNT_MUST_BE_POSITIVE' using errcode = '22023';
  end if;

  select a.* into v_auction
  from public.dreamledger_auctions a
  where a.id = p_auction_id
  for update;

  if not found then raise exception 'AUCTION_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_auction.status <> 'open' or v_auction.ends_at <= now() then
    raise exception 'AUCTION_CLOSED' using errcode = '55000';
  end if;
  if v_auction.auction_path <> 'A'
     or v_auction.platform_receives_proceeds
     or v_auction.platform_commission_bps <> 0 then
    raise exception 'PATH_A_INVARIANT_VIOLATION' using errcode = '23514';
  end if;
  if v_auction.seller_id = v_user_id then
    raise exception 'SELLER_CANNOT_BID_ON_OWN_AUCTION' using errcode = '42501';
  end if;
  if not v_auction.seller_trader_disclosure or not v_auction.direct_contract_confirmed then
    raise exception 'AUCTION_NOT_COMPLIANT_FOR_BIDDING' using errcode = '55000';
  end if;
  if not exists (
    select 1 from public.auction_seller_compliance_records r
    where r.auction_id = v_auction.id and r.seller_user_id = v_auction.seller_id
  ) then
    raise exception 'AUCTION_SELLER_COMPLIANCE_RECORD_REQUIRED' using errcode = '55000';
  end if;

  select greatest(v_auction.current_bid::bigint + 1,
                  coalesce(max(b.amount_minor), v_auction.current_bid::bigint) + 1)
    into v_minimum
  from public.auction_bids b
  where b.auction_id = v_auction.id;

  if p_amount_minor < v_minimum then
    raise exception 'BID_TOO_LOW: minimum accepted amount is % minor units', v_minimum
      using errcode = '22023';
  end if;

  insert into public.auction_bids (auction_id, bidder_user_id, amount_minor)
  values (v_auction.id, v_user_id, p_amount_minor)
  returning id into v_bid_id;

  update public.dreamledger_auctions
  set current_bid = p_amount_minor
  where id = v_auction.id;

  return query select v_bid_id, p_amount_minor, v_auction.ends_at;
end;
$$;

revoke all on function public.place_auction_bid(text, bigint) from public, anon;
grant execute on function public.place_auction_bid(text, bigint) to authenticated;

create or replace function public.close_expired_dreamledger_auctions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_count integer;
begin
  update public.dreamledger_auctions
  set status = 'closed', closed_at = coalesce(closed_at, now())
  where status = 'open' and ends_at <= now();
  get diagnostics v_count = row_count;

  update public.auction_seller_compliance_records r
  set bids_closed_at = coalesce(r.bids_closed_at, now()),
      retain_until = coalesce(r.retain_until, now() + interval '12 months')
  where r.auction_id in (
    select a.id from public.dreamledger_auctions a where a.status = 'closed'
  ) and r.bids_closed_at is null;

  return v_count;
end;
$$;

revoke all on function public.close_expired_dreamledger_auctions() from public, anon, authenticated;
grant execute on function public.close_expired_dreamledger_auctions() to service_role;

commit;
