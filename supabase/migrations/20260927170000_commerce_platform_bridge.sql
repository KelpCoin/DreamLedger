-- Commerce platform bridge: identity, tenant membership, durable actions, evidence, and safe commerce state.
-- Apply only after review. This migration intentionally does not alter unrelated legacy tables.

create table if not exists public.commerce_store_members (
  store_id uuid not null references public.commerce_stores(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('OWNER','ADMIN','OPERATOR','VIEWER')),
  created_at timestamptz not null default now(),
  primary key (store_id, user_id)
);

create index if not exists commerce_store_members_user_idx on public.commerce_store_members(user_id);

alter table public.commerce_stores add column if not exists slug text;
alter table public.commerce_stores add column if not exists status text not null default 'ACTIVE';
alter table public.commerce_stores add column if not exists owner_user_id uuid references auth.users(id);

alter table public.commerce_products add column if not exists slug text;
alter table public.commerce_products add column if not exists status text not null default 'ACTIVE';
alter table public.commerce_products add column if not exists external_provider text;
alter table public.commerce_products add column if not exists external_product_id text;

alter table public.commerce_variants add column if not exists external_price_id text;
alter table public.commerce_variants add column if not exists inventory_quantity integer not null default 0;
alter table public.commerce_variants add column if not exists inventory_policy text not null default 'DENY' check (inventory_policy in ('DENY','ALLOW_BACKORDER'));

alter table public.commerce_orders add column if not exists order_number text;
alter table public.commerce_orders add column if not exists payment_status text not null default 'PENDING';
alter table public.commerce_orders add column if not exists fulfillment_status text not null default 'UNFULFILLED';
alter table public.commerce_orders add column if not exists external_provider text;
alter table public.commerce_orders add column if not exists external_checkout_id text;
alter table public.commerce_orders add column if not exists receipt_token_hash text;
alter table public.commerce_orders add column if not exists paid_at timestamptz;
alter table public.commerce_orders add column if not exists fulfilled_at timestamptz;

create unique index if not exists commerce_orders_order_number_uidx
  on public.commerce_orders(order_number) where order_number is not null;
create unique index if not exists commerce_orders_external_checkout_uidx
  on public.commerce_orders(external_checkout_id) where external_checkout_id is not null;
create unique index if not exists commerce_orders_receipt_token_uidx
  on public.commerce_orders(receipt_token_hash) where receipt_token_hash is not null;

create table if not exists public.commerce_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  external_event_id text not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  processing_status text not null default 'RECEIVED'
    check (processing_status in ('RECEIVED','PROCESSED','FAILED','IGNORED')),
  error text,
  created_at timestamptz not null default now(),
  unique(provider, external_event_id)
);

create table if not exists public.commerce_actions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.commerce_stores(id) on delete cascade,
  actor_user_id uuid references auth.users(id),
  actor_type text not null check (actor_type in ('USER','AGENT','SYSTEM','WEBHOOK')),
  action_type text not null,
  target_type text,
  target_id text,
  status text not null default 'QUEUED'
    check (status in ('QUEUED','RUNNING','WAITING_APPROVAL','WAITING_EXTERNAL','RETRYING','SUCCEEDED','FAILED','CANCELLED')),
  idempotency_key text,
  policy_version text,
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  error text,
  attempt_count integer not null default 0,
  available_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(store_id, idempotency_key)
);

create index if not exists commerce_actions_status_idx
  on public.commerce_actions(status, available_at);
create index if not exists commerce_actions_target_idx
  on public.commerce_actions(target_type, target_id);

create table if not exists public.commerce_evidence_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.commerce_stores(id) on delete cascade,
  object_type text not null,
  object_id text not null,
  claim text not null,
  source_type text not null,
  source_ref text,
  observation jsonb not null default '{}'::jsonb,
  verdict text not null check (verdict in ('VERIFIED','UNVERIFIED','CONTRADICTED','STALE','TEST','SIMULATED','INTERNAL','UNMATCHED')),
  content_hash text,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists commerce_evidence_object_idx
  on public.commerce_evidence_events(object_type, object_id, observed_at desc);

create or replace function public.commerce_is_member(p_store_id uuid)
returns boolean
language sql
stable
security invoker
as $$
  select exists (
    select 1
    from public.commerce_store_members m
    where m.store_id = p_store_id
      and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.commerce_has_role(p_store_id uuid, p_roles text[])
returns boolean
language sql
stable
security invoker
as $$
  select exists (
    select 1
    from public.commerce_store_members m
    where m.store_id = p_store_id
      and m.user_id = (select auth.uid())
      and m.role = any(p_roles)
  );
$$;

alter table public.commerce_store_members enable row level security;
alter table public.commerce_webhook_events enable row level security;
alter table public.commerce_actions enable row level security;
alter table public.commerce_evidence_events enable row level security;

alter table public.commerce_stores enable row level security;
alter table public.commerce_products enable row level security;
alter table public.commerce_variants enable row level security;
alter table public.commerce_customers enable row level security;
alter table public.commerce_orders enable row level security;
alter table public.commerce_order_items enable row level security;
alter table public.commerce_fulfillments enable row level security;
alter table public.commerce_evidence enable row level security;

drop policy if exists commerce_store_members_select on public.commerce_store_members;
create policy commerce_store_members_select on public.commerce_store_members
for select to authenticated
using ((select auth.uid()) = user_id or public.commerce_is_member(store_id));

drop policy if exists commerce_store_select on public.commerce_stores;
create policy commerce_store_select on public.commerce_stores
for select to anon, authenticated
using (status = 'ACTIVE' or public.commerce_is_member(id));

drop policy if exists commerce_product_public_select on public.commerce_products;
create policy commerce_product_public_select on public.commerce_products
for select to anon, authenticated
using (
  status = 'ACTIVE'
  and exists (
    select 1 from public.commerce_stores s
    where s.id = store_id and s.status = 'ACTIVE'
  )
);

drop policy if exists commerce_product_member_all on public.commerce_products;
create policy commerce_product_member_all on public.commerce_products
for all to authenticated
using (public.commerce_has_role(store_id, array['OWNER','ADMIN','OPERATOR']))
with check (public.commerce_has_role(store_id, array['OWNER','ADMIN','OPERATOR']));

drop policy if exists commerce_variant_public_select on public.commerce_variants;
create policy commerce_variant_public_select on public.commerce_variants
for select to anon, authenticated
using (
  exists (
    select 1
    from public.commerce_products p
    join public.commerce_stores s on s.id = p.store_id
    where p.id = product_id and p.status = 'ACTIVE' and s.status = 'ACTIVE'
  )
);

drop policy if exists commerce_variant_member_all on public.commerce_variants;
create policy commerce_variant_member_all on public.commerce_variants
for all to authenticated
using (
  exists (select 1 from public.commerce_products p where p.id = product_id and public.commerce_has_role(p.store_id, array['OWNER','ADMIN','OPERATOR']))
)
with check (
  exists (select 1 from public.commerce_products p where p.id = product_id and public.commerce_has_role(p.store_id, array['OWNER','ADMIN','OPERATOR']))
);

drop policy if exists commerce_customer_member_select on public.commerce_customers;
create policy commerce_customer_member_select on public.commerce_customers
for select to authenticated
using (public.commerce_is_member(store_id));

drop policy if exists commerce_order_member_select on public.commerce_orders;
create policy commerce_order_member_select on public.commerce_orders
for select to authenticated
using (public.commerce_is_member(store_id));

drop policy if exists commerce_order_item_member_select on public.commerce_order_items;
create policy commerce_order_item_member_select on public.commerce_order_items
for select to authenticated
using (
  exists (select 1 from public.commerce_orders o where o.id = order_id and public.commerce_is_member(o.store_id))
);

drop policy if exists commerce_fulfillment_member_select on public.commerce_fulfillments;
create policy commerce_fulfillment_member_select on public.commerce_fulfillments
for select to authenticated
using (
  exists (select 1 from public.commerce_orders o where o.id = order_id and public.commerce_is_member(o.store_id))
);

drop policy if exists commerce_action_member_select on public.commerce_actions;
create policy commerce_action_member_select on public.commerce_actions
for select to authenticated
using (public.commerce_is_member(store_id));

drop policy if exists commerce_evidence_event_member_select on public.commerce_evidence_events;
create policy commerce_evidence_event_member_select on public.commerce_evidence_events
for select to authenticated
using (public.commerce_is_member(store_id));

drop policy if exists commerce_evidence_member_select on public.commerce_evidence;
create policy commerce_evidence_member_select on public.commerce_evidence
for select to authenticated
using (
  exists (select 1 from public.commerce_orders o where o.id = order_id and public.commerce_is_member(o.store_id))
);

-- No client policy is granted for webhook events or privileged action/evidence writes.
-- Service-role/server-side workers perform those mutations after authentication and verification.

create or replace view public.commerce_order_operations
with (security_invoker = true)
as
select
  o.id,
  o.store_id,
  o.order_number,
  o.status,
  o.payment_status,
  o.fulfillment_status,
  o.external_provider,
  o.external_checkout_id,
  o.paid_at,
  o.fulfilled_at,
  o.created_at
from public.commerce_orders o;

comment on view public.commerce_order_operations is
'Operational order projection. security_invoker preserves underlying RLS.';
