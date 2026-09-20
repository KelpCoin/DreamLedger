create table if not exists public.marketplace_seller_accounts (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.marketplace_sellers(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  stripe_connect_account_id text unique,
  account_type text not null default 'express' check (account_type in ('express','standard','custom')),
  onboarding_status text not null default 'not_started' check (onboarding_status in ('not_started','pending','complete','restricted')),
  details_submitted boolean not null default false,
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  requirements_due jsonb not null default '[]'::jsonb,
  last_stripe_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(seller_id),
  unique(owner_user_id)
);

alter table public.marketplace_seller_accounts enable row level security;
grant select on public.marketplace_seller_accounts to authenticated;

create policy "seller accounts owner read"
on public.marketplace_seller_accounts
for select to authenticated
using ((select auth.uid()) = owner_user_id);

create index if not exists marketplace_seller_accounts_owner_idx
  on public.marketplace_seller_accounts(owner_user_id);

create index if not exists marketplace_seller_accounts_status_idx
  on public.marketplace_seller_accounts(onboarding_status,payouts_enabled);
