-- DreamLedger B2B marketplace foundation v1
-- Adds only missing primitives to the existing marketplace model. No fulfillment writer is introduced.

create extension if not exists pgcrypto;

alter table public.marketplace_seller_accounts
  add column if not exists display_name text,
  add column if not exists email text,
  add column if not exists country text not null default 'NZ',
  add column if not exists default_currency text not null default 'NZD',
  add column if not exists payout_speed text not null default 'daily',
  add column if not exists agent_enabled boolean not null default false;

alter table public.marketplace_seller_accounts
  drop constraint if exists marketplace_seller_accounts_payout_speed_check;
alter table public.marketplace_seller_accounts
  add constraint marketplace_seller_accounts_payout_speed_check
  check (payout_speed in ('instant','daily','weekly'));

alter table public.marketplace_listings
  add column if not exists slug text,
  add column if not exists reserved integer not null default 0,
  add column if not exists shipping_profile jsonb not null default '{}'::jsonb,
  add column if not exists evidence jsonb not null default '{}'::jsonb,
  add column if not exists agent_purchasable boolean not null default false,
  add column if not exists published_at timestamptz;

create unique index if not exists marketplace_listings_slug_uidx
  on public.marketplace_listings(slug) where slug is not null;

create table if not exists public.agent_identities (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null unique,
  principal_user_id uuid not null references auth.users(id) on delete cascade,
  principal_type text not null default 'human',
  capabilities jsonb not null default '[]'::jsonb,
  authorization_scope jsonb not null default '{}'::jsonb,
  public_key text not null,
  signature_alg text not null default 'ed25519',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  constraint agent_identities_principal_type_check check (principal_type in ('human','organisation')),
  constraint agent_identities_status_check check (status in ('active','suspended','revoked'))
);

create index if not exists agent_identities_principal_idx
  on public.agent_identities(principal_user_id);

alter table public.agent_identities enable row level security;
revoke all on public.agent_identities from anon;
grant select, insert, update on public.agent_identities to authenticated;

drop policy if exists agent_identities_owner_select on public.agent_identities;
create policy agent_identities_owner_select on public.agent_identities
for select to authenticated using ((select auth.uid()) = principal_user_id);
drop policy if exists agent_identities_owner_insert on public.agent_identities;
create policy agent_identities_owner_insert on public.agent_identities
for insert to authenticated with check ((select auth.uid()) = principal_user_id);
drop policy if exists agent_identities_owner_update on public.agent_identities;
create policy agent_identities_owner_update on public.agent_identities
for update to authenticated using ((select auth.uid()) = principal_user_id)
with check ((select auth.uid()) = principal_user_id);

create table if not exists public.verification_receipts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.marketplace_orders(id) on delete cascade,
  receipt_json jsonb not null,
  signature text,
  public_key_ref text,
  classification text not null,
  issued_at timestamptz not null default now(),
  verify_url text,
  constraint verification_receipts_classification_check
    check (classification in ('VERIFIED','UNVERIFIED','CONTRADICTED','ORPHANED','MISSING'))
);

create unique index if not exists verification_receipts_order_uidx
  on public.verification_receipts(order_id);

alter table public.verification_receipts enable row level security;
revoke all on public.verification_receipts from anon;
grant select on public.verification_receipts to authenticated;

drop policy if exists verification_receipts_authenticated_read on public.verification_receipts;
create policy verification_receipts_authenticated_read on public.verification_receipts
for select to authenticated using (true);

create table if not exists public.verified_reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.marketplace_orders(id) on delete cascade,
  reviewer_user_id uuid not null references auth.users(id) on delete cascade,
  seller_id uuid not null references public.marketplace_sellers(id) on delete cascade,
  rating integer not null,
  body text,
  verified_purchase boolean not null default true,
  created_at timestamptz not null default now(),
  constraint verified_reviews_rating_check check (rating between 1 and 5),
  constraint verified_reviews_verified_check check (verified_purchase = true),
  unique(order_id, reviewer_user_id)
);

create index if not exists verified_reviews_seller_idx
  on public.verified_reviews(seller_id, created_at desc);

alter table public.verified_reviews enable row level security;
revoke all on public.verified_reviews from anon;
grant select, insert on public.verified_reviews to authenticated;

drop policy if exists verified_reviews_public_read on public.verified_reviews;
create policy verified_reviews_public_read on public.verified_reviews
for select to authenticated using (true);
drop policy if exists verified_reviews_buyer_insert on public.verified_reviews;
create policy verified_reviews_buyer_insert on public.verified_reviews
for insert to authenticated with check ((select auth.uid()) = reviewer_user_id);

create or replace function public.enforce_verified_review_purchase()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare paid boolean;
begin
  select (payment_status = 'paid') into paid
  from public.marketplace_orders
  where id = new.order_id;
  if coalesce(paid, false) is not true then
    raise exception 'REVIEW_REQUIRES_PAID_ORDER';
  end if;
  if not exists (
    select 1 from public.marketplace_orders o
    where o.id = new.order_id and o.seller_id = new.seller_id
  ) and not exists (
    select 1 from public.marketplace_order_items oi
    where oi.order_id = new.order_id and oi.seller_id = new.seller_id
  ) then
    raise exception 'REVIEW_SELLER_NOT_IN_ORDER';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_verified_review_purchase on public.verified_reviews;
create trigger trg_verified_review_purchase
before insert on public.verified_reviews
for each row execute function public.enforce_verified_review_purchase();

create or replace function public.enforce_payout_enabled_publication()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare enabled boolean;
begin
  if new.status = 'published' and coalesce(old.status, '') <> 'published' then
    select coalesce(sa.payouts_enabled, false) into enabled
    from public.marketplace_seller_accounts sa
    where sa.seller_id = new.seller_id;
    if coalesce(enabled, false) is not true then
      raise exception 'LISTING_REQUIRES_PAYOUTS_ENABLED';
    end if;
    new.published_at := coalesce(new.published_at, now());
  end if;
  return new;
end;
$$;

drop trigger if exists trg_listing_payout_gate on public.marketplace_listings;
create trigger trg_listing_payout_gate
before update of status on public.marketplace_listings
for each row execute function public.enforce_payout_enabled_publication();

create index if not exists marketplace_transfers_order_seller_idx
  on public.marketplace_transfers(order_id, seller_id);
create index if not exists marketplace_fulfillments_order_idx
  on public.marketplace_fulfillments(order_id, created_at desc);
