create table if not exists public.agent_toll_products (
  product_id text primary key,
  name text not null,
  price_usd numeric(12,6) not null check (price_usd > 0),
  endpoint text not null,
  active boolean not null default true,
  description text not null,
  created_at timestamptz not null default now()
);

insert into public.agent_toll_products(product_id,name,price_usd,endpoint,description)
values
 ('truth.reconcile','Payment/order reconciliation',0.02,'POST /v1/reconcile','Checks whether supplied payment/order references have a durable attributable commerce chain.'),
 ('truth.contradiction','Contradiction check',0.02,'POST /v1/contradictions','Checks supplied claims against durable DreamLedger records and reports contradictions.'),
 ('truth.passport','Evidence passport',0.05,'POST /v1/passport','Builds a machine-readable evidence passport from an existing order/outcome chain.')
on conflict(product_id) do update set name=excluded.name,price_usd=excluded.price_usd,endpoint=excluded.endpoint,description=excluded.description,active=true;

create table if not exists public.agent_toll_calls (
  call_id uuid primary key default gen_random_uuid(),
  product_id text not null references public.agent_toll_products(product_id),
  payer text,
  request_hash text not null,
  payment_tx text,
  payment_network text,
  payment_amount_usd numeric(12,6),
  settlement_status text not null default 'UNSETTLED' check (settlement_status in ('UNSETTLED','SETTLED','FAILED')),
  result_hash text,
  result jsonb,
  created_at timestamptz not null default now(),
  settled_at timestamptz
);

create unique index if not exists agent_toll_calls_request_hash_uq on public.agent_toll_calls(request_hash);
create index if not exists agent_toll_calls_product_created_idx on public.agent_toll_calls(product_id,created_at desc);

alter table public.agent_toll_products enable row level security;
alter table public.agent_toll_calls enable row level security;

revoke all on public.agent_toll_products from anon, authenticated;
revoke all on public.agent_toll_calls from anon, authenticated;
grant all on public.agent_toll_products to service_role;
grant all on public.agent_toll_calls to service_role;
