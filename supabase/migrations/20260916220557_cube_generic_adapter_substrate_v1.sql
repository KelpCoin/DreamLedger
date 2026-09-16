create table if not exists public.cube_silo_registry (
  silo_id text primary key,
  display_name text not null,
  identity jsonb not null default '{}'::jsonb,
  community jsonb not null default '{}'::jsonb,
  production jsonb not null default '{}'::jsonb,
  distribution jsonb not null default '{}'::jsonb,
  commerce jsonb not null default '{}'::jsonb,
  measurement jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cube_adapter_registry (
  adapter_id text primary key,
  adapter_type text not null,
  provider text not null,
  capability text not null,
  config jsonb not null default '{}'::jsonb,
  status text not null default 'UNVERIFIED' check (status in ('VERIFIED','UNVERIFIED','CONTRADICTED','STALE','TEST','SIMULATED','INTERNAL','UNMATCHED')),
  silo_id text references public.cube_silo_registry(silo_id) on delete cascade,
  last_observed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cube_adapter_registry_silo_idx on public.cube_adapter_registry(silo_id);
create index if not exists cube_adapter_registry_type_idx on public.cube_adapter_registry(adapter_type);

create table if not exists public.cube_opportunities (
  opportunity_id uuid primary key default gen_random_uuid(),
  silo_id text not null references public.cube_silo_registry(silo_id) on delete cascade,
  source text not null,
  subject text not null,
  observed_at timestamptz not null default now(),
  evidence jsonb not null default '[]'::jsonb,
  confidence numeric,
  audience jsonb not null default '{}'::jsonb,
  commercial_relevance numeric,
  recommended_action text,
  status text not null default 'DETECTED' check (status in ('DETECTED','VERIFIED','INTERESTING','SELECTED','DRAFTED','APPROVED','PUBLISHED','CONVERTED','DID_NOT_CONVERT','ARCHIVED')),
  outputs jsonb not null default '[]'::jsonb,
  outcome jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cube_opportunities_silo_status_idx on public.cube_opportunities(silo_id,status);
create index if not exists cube_opportunities_observed_idx on public.cube_opportunities(observed_at desc);

create table if not exists public.cube_predictions (
  prediction_id uuid primary key default gen_random_uuid(),
  silo_id text not null references public.cube_silo_registry(silo_id) on delete cascade,
  opportunity_id uuid references public.cube_opportunities(opportunity_id) on delete set null,
  subject text not null,
  thesis text not null,
  created_at timestamptz not null default now(),
  check_at_30d timestamptz,
  check_at_60d timestamptz,
  check_at_90d timestamptz,
  price_at_prediction numeric,
  outcomes jsonb not null default '{}'::jsonb,
  status text not null default 'OPEN' check (status in ('OPEN','VERIFIED','UNVERIFIED','CONTRADICTED','STALE')),
  created_by text,
  evidence jsonb not null default '[]'::jsonb
);

create index if not exists cube_predictions_silo_status_idx on public.cube_predictions(silo_id,status);
create index if not exists cube_predictions_due_idx on public.cube_predictions(check_at_30d,check_at_60d,check_at_90d);

create table if not exists public.cube_adapter_observations (
  observation_id uuid primary key default gen_random_uuid(),
  adapter_id text not null references public.cube_adapter_registry(adapter_id) on delete cascade,
  silo_id text not null references public.cube_silo_registry(silo_id) on delete cascade,
  subject text not null,
  observed_at timestamptz not null default now(),
  value jsonb not null,
  source_ref text,
  source_hash text,
  verification_status text not null default 'UNVERIFIED' check (verification_status in ('VERIFIED','UNVERIFIED','CONTRADICTED','STALE','TEST','SIMULATED','INTERNAL','UNMATCHED')),
  evidence jsonb not null default '[]'::jsonb,
  unique(adapter_id, subject, observed_at, source_hash)
);

create index if not exists cube_adapter_observations_subject_idx on public.cube_adapter_observations(silo_id,subject,observed_at desc);

create table if not exists public.cube_evidence_vault (
  evidence_id uuid primary key default gen_random_uuid(),
  silo_id text not null references public.cube_silo_registry(silo_id) on delete cascade,
  source text not null,
  observation jsonb not null,
  observed_at timestamptz not null default now(),
  verification_status text not null default 'UNVERIFIED' check (verification_status in ('VERIFIED','UNVERIFIED','CONTRADICTED','STALE','TEST','SIMULATED','INTERNAL','UNMATCHED')),
  decision jsonb,
  outcome jsonb,
  source_ref text,
  content_hash text,
  created_at timestamptz not null default now()
);

create index if not exists cube_evidence_vault_silo_time_idx on public.cube_evidence_vault(silo_id,observed_at desc);

alter table public.cube_silo_registry enable row level security;
alter table public.cube_adapter_registry enable row level security;
alter table public.cube_opportunities enable row level security;
alter table public.cube_predictions enable row level security;
alter table public.cube_adapter_observations enable row level security;
alter table public.cube_evidence_vault enable row level security;

comment on table public.cube_silo_registry is 'Generic CUBE silo configuration. Keep silo-specific identity and adapters here; do not encode domain assumptions.';
comment on table public.cube_adapter_registry is 'Generic adapter registry shared across CUBE silos.';
comment on table public.cube_opportunities is 'Portable opportunity state machine shared by all CUBE silos.';
comment on table public.cube_predictions is 'Portable prediction ledger for measurable claims and later outcomes.';
comment on table public.cube_adapter_observations is 'Normalized observations emitted by generic or silo-specific adapters.';
comment on table public.cube_evidence_vault is 'Evidence memory: source -> observation -> verification -> decision -> outcome.';
