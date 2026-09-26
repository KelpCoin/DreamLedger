create table if not exists public.cube_observations (
  observation_id uuid primary key default gen_random_uuid(),
  observed_at timestamptz not null default now(),
  source_ip inet,
  source_ip_hash text,
  user_agent text,
  request_method text not null,
  request_path text not null,
  http_status integer,
  redirect_target text,
  stripe_session_id text,
  stripe_event_id text,
  offer_id text,
  sku_id text,
  economic_state text not null default 'OBSERVED',
  observation_source text not null default 'dreamledger_application',
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists cube_observations_observed_at_idx
  on public.cube_observations (observed_at desc);

create index if not exists cube_observations_path_idx
  on public.cube_observations (request_path, observed_at desc);

create index if not exists cube_observations_session_idx
  on public.cube_observations (stripe_session_id)
  where stripe_session_id is not null;

create index if not exists cube_observations_event_idx
  on public.cube_observations (stripe_event_id)
  where stripe_event_id is not null;

alter table public.cube_observations enable row level security;

revoke all on table public.cube_observations from anon, authenticated;
grant all on table public.cube_observations to service_role;
