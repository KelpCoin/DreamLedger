create table if not exists public.economic_silo_registry (
  silo_id text primary key, display_name text not null, slug text not null unique,
  source_signal_id text, domain_id text, template_key text not null, market_region text not null,
  buyer_problem text, proposed_deliverable text, lifecycle_stage text not null default 'CANDIDATE',
  qualification_status text not null default 'UNQUALIFIED', evidence_status text not null default 'UNVERIFIED',
  public_visibility text not null default 'HIDDEN', public_route text not null,
  commerce_cell_id uuid, offer_id uuid, human_approval_required boolean not null default true,
  external_action_allowed boolean not null default false, origin text not null default 'DERIVED_FROM_OBSERVED_SIGNAL',
  provenance jsonb not null default '{}'::jsonb,
  metrics jsonb not null default '{"impressions":0,"checkout_intents":0,"settled_payments":0,"fulfilled_orders":0,"verified_outcomes":0}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists economic_silo_registry_stage_idx on public.economic_silo_registry(lifecycle_stage);
create index if not exists economic_silo_registry_signal_idx on public.economic_silo_registry(source_signal_id);
create index if not exists economic_silo_registry_domain_idx on public.economic_silo_registry(domain_id);
create index if not exists economic_silo_registry_template_idx on public.economic_silo_registry(template_key);
create index if not exists economic_silo_registry_market_idx on public.economic_silo_registry(market_region);
alter table public.economic_silo_registry enable row level security;

create table if not exists public.silo_factory_batches (
  batch_id uuid primary key default gen_random_uuid(), requested_count integer not null,
  inserted_count integer not null default 0, source_signal_count integer not null default 0,
  status text not null default 'CREATED', generator_version text not null,
  created_at timestamptz not null default now(), completed_at timestamptz, metadata jsonb not null default '{}'::jsonb
);
create index if not exists silo_factory_batches_status_idx on public.silo_factory_batches(status,created_at desc);
alter table public.silo_factory_batches enable row level security;

create table if not exists public.silo_agent_runs (
  id uuid primary key default gen_random_uuid(), silo_id text not null references public.economic_silo_registry(silo_id) on delete cascade,
  agent text not null, stage text not null, status text not null default 'QUEUED',
  input_hash text, output jsonb not null default '{}'::jsonb, error text,
  created_at timestamptz not null default now(), completed_at timestamptz
);
create index if not exists silo_agent_runs_silo_idx on public.silo_agent_runs(silo_id,created_at desc);
create index if not exists silo_agent_runs_agent_idx on public.silo_agent_runs(agent,status,created_at desc);
alter table public.silo_agent_runs enable row level security;

create or replace function public.economic_silo_registry_summary() returns jsonb
language sql security definer set search_path=public as $$
select jsonb_build_object(
'total',count(*),
'candidate',count(*) filter(where lifecycle_stage='CANDIDATE'),
'qualified',count(*) filter(where lifecycle_stage='QUALIFIED'),
'sellable',count(*) filter(where lifecycle_stage='SELLABLE'),
'active',count(*) filter(where lifecycle_stage='ACTIVE'),
'verified',count(*) filter(where lifecycle_stage='VERIFIED'),
'public_visible',count(*) filter(where public_visibility='PUBLIC'),
'externally_paid',coalesce(sum((metrics->>'settled_payments')::integer),0),
'fulfilled_orders',coalesce(sum((metrics->>'fulfilled_orders')::integer),0),
'verified_outcomes',coalesce(sum((metrics->>'verified_outcomes')::integer),0)
) from public.economic_silo_registry; $$;