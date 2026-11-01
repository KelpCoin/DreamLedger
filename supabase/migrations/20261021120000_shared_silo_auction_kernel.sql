-- DreamLedger shared silo auction kernel v1.
-- Deliberately additive. Does not alter MTG tables or payment/settlement state.
-- Apply only after database connectivity is healthy and this migration is reviewed.

create table if not exists public.marketplace_auctions (
  id uuid primary key default gen_random_uuid(),
  silo_id text not null check (silo_id ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  source_type text not null check (source_type in ('listing','card','deck','collectible','service','rfq','digital_asset')),
  source_id text not null,
  seller_id uuid not null references auth.users(id) on delete restrict,
  title text not null check (length(trim(title)) between 3 and 240),
  description text not null default '',
  currency char(3) not null default 'NZD' check (currency ~ '^[A-Z]{3}$'),
  start_price numeric(12,2) not null check (start_price > 0),
  min_increment numeric(12,2) not null default 0.50 check (min_increment > 0),
  reserve_price numeric(12,2) check (reserve_price is null or reserve_price >= start_price),
  current_price numeric(12,2) not null check (current_price >= start_price),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'draft'
    check (status in ('draft','scheduled','open','ended','awaiting_payment','paid','fulfilled','cancelled','expired')),
  leading_bid_id uuid,
  leading_bidder_id uuid references auth.users(id) on delete restrict,
  publication_approved_at timestamptz,
  publication_approved_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (silo_id, source_type, source_id),
  check (ends_at > starts_at),
  check ((publication_approved_at is null and publication_approved_by is null)
      or (publication_approved_at is not null and publication_approved_by is not null)),
  check ((status <> 'open') or publication_approved_at is not null)
);

create index if not exists marketplace_auctions_discovery_idx
  on public.marketplace_auctions (silo_id, status, ends_at);
create index if not exists marketplace_auctions_seller_idx
  on public.marketplace_auctions (seller_id, created_at desc);

create table if not exists public.marketplace_auction_bids (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.marketplace_auctions(id) on delete restrict,
  bidder_id uuid not null references auth.users(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  idempotency_key text not null check (length(idempotency_key) between 16 and 128),
  created_at timestamptz not null default now(),
  unique (auction_id, bidder_id, idempotency_key)
);
create index if not exists marketplace_auction_bids_history_idx
  on public.marketplace_auction_bids (auction_id, created_at desc);
create index if not exists marketplace_auction_bids_bidder_idx
  on public.marketplace_auction_bids (bidder_id, created_at desc);

alter table public.marketplace_auctions enable row level security;
alter table public.marketplace_auction_bids enable row level security;

revoke all on public.marketplace_auctions from anon, authenticated;
revoke all on public.marketplace_auction_bids from anon, authenticated;
grant select on public.marketplace_auctions to anon, authenticated;
grant select on public.marketplace_auction_bids to authenticated;

drop policy if exists marketplace_auctions_public_read on public.marketplace_auctions;
create policy marketplace_auctions_public_read on public.marketplace_auctions
for select to anon, authenticated
using (
  (status in ('open','ended','awaiting_payment','paid','fulfilled') and publication_approved_at is not null)
  or seller_id = (select auth.uid())
);

drop policy if exists marketplace_auction_bids_private_read on public.marketplace_auction_bids;
create policy marketplace_auction_bids_private_read on public.marketplace_auction_bids
for select to authenticated
using (
  bidder_id = (select auth.uid())
  or exists (
    select 1 from public.marketplace_auctions a
    where a.id = auction_id and a.seller_id = (select auth.uid())
  )
);

-- No client may insert bids or mutate auction/bid state directly.
-- A trusted reviewer/service process must approve publication; seller-facing
-- clients can only create drafts through a separate reviewed listing workflow.
revoke insert, update, delete on public.marketplace_auctions from anon, authenticated;
revoke insert, update, delete on public.marketplace_auction_bids from anon, authenticated;

create or replace function public.place_marketplace_auction_bid(
  p_auction_id uuid,
  p_amount numeric,
  p_idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_bidder uuid := auth.uid();
  v_auction public.marketplace_auctions%rowtype;
  v_bid public.marketplace_auction_bids%rowtype;
  v_minimum numeric(12,2);
begin
  if v_bidder is null then
    raise exception 'AUCTION_AUTH_REQUIRED' using errcode = '28000';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'AUCTION_BID_AMOUNT_INVALID' using errcode = '22023';
  end if;
  if p_idempotency_key is null or length(p_idempotency_key) < 16 or length(p_idempotency_key) > 128 then
    raise exception 'AUCTION_IDEMPOTENCY_KEY_INVALID' using errcode = '22023';
  end if;

  select * into v_auction
  from public.marketplace_auctions
  where id = p_auction_id
  for update;

  if not found then
    raise exception 'AUCTION_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- Replays return the original accepted bid, never create a second bid.
  select * into v_bid
  from public.marketplace_auction_bids
  where auction_id = p_auction_id
    and bidder_id = v_bidder
    and idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object(
      'status','IDEMPOTENT_REPLAY',
      'auction_id',p_auction_id,
      'bid_id',v_bid.id,
      'accepted_amount',v_bid.amount,
      'current_price',v_auction.current_price
    );
  end if;

  if v_auction.status <> 'open' or v_auction.publication_approved_at is null then
    raise exception 'AUCTION_NOT_OPEN' using errcode = '55000';
  end if;
  if v_auction.starts_at > now() or v_auction.ends_at <= now() then
    raise exception 'AUCTION_OUTSIDE_ACTIVE_WINDOW' using errcode = '55000';
  end if;
  if v_auction.seller_id = v_bidder then
    raise exception 'AUCTION_SELF_BIDDING_FORBIDDEN' using errcode = '42501';
  end if;

  v_minimum := v_auction.current_price + v_auction.min_increment;
  if p_amount < v_minimum then
    raise exception 'AUCTION_BID_BELOW_MINIMUM: %', v_minimum using errcode = '22023';
  end if;

  insert into public.marketplace_auction_bids
    (auction_id, bidder_id, amount, idempotency_key)
  values
    (p_auction_id, v_bidder, p_amount, p_idempotency_key)
  returning * into v_bid;

  update public.marketplace_auctions
  set current_price = p_amount,
      leading_bid_id = v_bid.id,
      leading_bidder_id = v_bidder,
      updated_at = now()
  where id = p_auction_id;

  return jsonb_build_object(
    'status','BID_ACCEPTED',
    'auction_id',p_auction_id,
    'bid_id',v_bid.id,
    'accepted_amount',v_bid.amount,
    'current_price',p_amount,
    'currency',v_auction.currency,
    'ends_at',v_auction.ends_at
  );
end;
$$;

revoke all on function public.place_marketplace_auction_bid(uuid,numeric,text) from public, anon;
grant execute on function public.place_marketplace_auction_bid(uuid,numeric,text) to authenticated;

-- Publication approval is deliberately not granted to seller/client roles.
-- Winner settlement and fulfillment remain the existing commerce kernel's job.
