create table if not exists public.marketplace_transfers (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.marketplace_orders(id) on delete cascade,
  seller_id uuid not null references public.marketplace_sellers(id) on delete restrict,
  seller_account_id uuid references public.marketplace_seller_accounts(id) on delete restrict,
  stripe_transfer_id text unique,
  transfer_group text not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null default 'nzd' check (lower(currency) = 'nzd'),
  status text not null default 'pending'
    check (status in ('pending','created','paid','failed','reversed')),
  stripe_charge_id text,
  idempotency_key text not null unique,
  failure_code text,
  failure_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, seller_id)
);

create index if not exists marketplace_transfers_order_idx
  on public.marketplace_transfers(order_id, created_at);
create index if not exists marketplace_transfers_seller_idx
  on public.marketplace_transfers(seller_id, status, created_at);
create index if not exists marketplace_transfers_group_idx
  on public.marketplace_transfers(transfer_group);
create index if not exists marketplace_transfers_stripe_charge_idx
  on public.marketplace_transfers(stripe_charge_id);

alter table public.marketplace_transfers enable row level security;

grant select on public.marketplace_transfers to authenticated;

drop policy if exists "marketplace_transfers_owner_read" on public.marketplace_transfers;
create policy "marketplace_transfers_owner_read"
on public.marketplace_transfers
for select
to authenticated
using (
  exists (
    select 1 from public.marketplace_orders o
    where o.id = marketplace_transfers.order_id
      and o.buyer_user_id = (select auth.uid())
  )
  or exists (
    select 1 from public.marketplace_seller_accounts sa
    where sa.id = marketplace_transfers.seller_account_id
      and sa.owner_user_id = (select auth.uid())
  )
);

comment on table public.marketplace_transfers is
  'Stripe Connect separate-charges-and-transfers ledger. One row per seller allocation within a marketplace order.';

comment on column public.marketplace_transfers.transfer_group is
  'Stripe transfer_group shared by the platform charge and all seller transfers for the order.';

comment on column public.marketplace_transfers.amount_minor is
  'Transfer amount in the currency minor unit, currently NZD cents.';
