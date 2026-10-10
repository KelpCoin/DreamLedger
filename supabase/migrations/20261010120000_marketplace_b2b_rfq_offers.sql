-- DreamLedger B2B marketplace persistence v1.
-- RFQs and offers are transaction records, not a second payment ledger.
-- Existing marketplace_orders + canonical Stripe settlement remain authoritative for orders and money.
create extension if not exists pgcrypto;

create table if not exists public.marketplace_b2b_rfqs (
  id uuid primary key default gen_random_uuid(),
  buyer_user_id uuid not null references auth.users(id) on delete restrict,
  title text not null check (length(trim(title)) between 1 and 120),
  description text not null check (length(trim(description)) between 1 and 4000),
  category text not null default 'General' check (length(category) <= 80),
  budget_minor bigint check (budget_minor is null or budget_minor > 0),
  currency text not null default 'nzd' check (lower(currency) = 'nzd'),
  deadline timestamptz,
  status text not null default 'open' check (status in ('open','awarded','cancelled','expired')),
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (buyer_user_id, idempotency_key)
);
create index if not exists marketplace_b2b_rfqs_open_idx
  on public.marketplace_b2b_rfqs(status, created_at desc);
create index if not exists marketplace_b2b_rfqs_buyer_idx
  on public.marketplace_b2b_rfqs(buyer_user_id, created_at desc);

create table if not exists public.marketplace_b2b_offers (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.marketplace_b2b_rfqs(id) on delete restrict,
  supplier_user_id uuid not null references auth.users(id) on delete restrict,
  title text not null check (length(trim(title)) between 1 and 120),
  description text not null check (length(trim(description)) between 1 and 4000),
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null default 'nzd' check (lower(currency) = 'nzd'),
  lead_time text not null default '' check (length(lead_time) <= 80),
  terms text not null default '' check (length(terms) <= 1000),
  status text not null default 'submitted' check (status in ('submitted','withdrawn','accepted','rejected')),
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (supplier_user_id, idempotency_key)
);
create index if not exists marketplace_b2b_offers_rfq_idx
  on public.marketplace_b2b_offers(rfq_id, status, created_at);
create index if not exists marketplace_b2b_offers_supplier_idx
  on public.marketplace_b2b_offers(supplier_user_id, created_at desc);

alter table public.marketplace_b2b_rfqs enable row level security;
alter table public.marketplace_b2b_offers enable row level security;
revoke all on public.marketplace_b2b_rfqs from anon, authenticated;
revoke all on public.marketplace_b2b_offers from anon, authenticated;
grant select, insert, update on public.marketplace_b2b_rfqs to service_role;
grant select, insert, update on public.marketplace_b2b_offers to service_role;

comment on table public.marketplace_b2b_rfqs is
  'Durable B2B sourcing requests. Does not itself represent an order, payment, or revenue.';
comment on table public.marketplace_b2b_offers is
  'Supplier responses to B2B RFQs. Acceptance must hand off to the canonical marketplace order and Stripe settlement path.';
