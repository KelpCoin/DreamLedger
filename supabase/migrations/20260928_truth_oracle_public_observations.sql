create table if not exists public.truth_oracle_public_observations (
  observation_id uuid primary key default gen_random_uuid(),
  domain text not null,
  subject text not null,
  item text not null,
  value_numeric numeric,
  unit text,
  currency text,
  location_name text,
  latitude double precision,
  longitude double precision,
  source_name text not null,
  source_url text not null,
  source_observed_at timestamptz,
  retrieved_at timestamptz not null default now(),
  freshness_seconds integer,
  status text not null default 'OBSERVED',
  evidence_hash text not null,
  raw_ref text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint truth_oracle_public_observations_status_ck check (status in ('OBSERVED','VERIFIED','STALE','CONTRADICTED','UNKNOWN'))
);

create index if not exists truth_oracle_public_obs_lookup_idx
  on public.truth_oracle_public_observations(domain,subject,location_name,retrieved_at desc);
create index if not exists truth_oracle_public_obs_fresh_idx
  on public.truth_oracle_public_observations(domain,source_observed_at desc);
create unique index if not exists truth_oracle_public_obs_hash_uq
  on public.truth_oracle_public_observations(evidence_hash);

alter table public.truth_oracle_public_observations enable row level security;

drop policy if exists truth_oracle_public_observations_anon_read
  on public.truth_oracle_public_observations;

create policy truth_oracle_public_observations_anon_read
  on public.truth_oracle_public_observations
  for select to anon using (true);

grant select on public.truth_oracle_public_observations to anon, authenticated;

create or replace view public.truth_oracle_public_latest_fuel as
select distinct on (subject, location_name, source_name)
  observation_id, subject, item, value_numeric, unit, currency, location_name,
  latitude, longitude, source_name, source_url, source_observed_at, retrieved_at,
  freshness_seconds, status, evidence_hash, metadata
from public.truth_oracle_public_observations
where domain='fuel'
order by subject,location_name,source_name,retrieved_at desc;

grant select on public.truth_oracle_public_latest_fuel to anon, authenticated;
