begin;

create table if not exists public.cosmetic_creator_splits (
  cosmetic_id text primary key,
  creator_wallet text,
  split_bps integer not null default 0 check (split_bps >= 0 and split_bps <= 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cosmetic_sales (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  cosmetic_id text not null,
  stripe_event_id text not null unique,
  stripe_checkout_session_id text not null unique,
  stripe_payment_intent_id text,
  amount_minor bigint not null,
  currency text not null,
  payout_status text not null default 'none' check (payout_status in ('none','pending','paid','failed','skipped')),
  payout_reference text,
  settled_at timestamptz not null default now(),
  unique (account_id, cosmetic_id)
);

create index if not exists cosmetic_sales_account_idx
  on public.cosmetic_sales (account_id, settled_at desc);

create index if not exists cosmetic_sales_cosmetic_idx
  on public.cosmetic_sales (cosmetic_id, settled_at desc);

alter table public.cosmetic_creator_splits enable row level security;
alter table public.cosmetic_sales enable row level security;

drop policy if exists "buyers read own settled cosmetics" on public.cosmetic_sales;
create policy "buyers read own settled cosmetics"
  on public.cosmetic_sales for select
  to authenticated
  using (account_id = auth.uid());

create or replace view public.owned_cosmetics
with (security_invoker = true)
as
select account_id, cosmetic_id, settled_at
from public.cosmetic_sales
where payout_status <> 'failed';

commit;
