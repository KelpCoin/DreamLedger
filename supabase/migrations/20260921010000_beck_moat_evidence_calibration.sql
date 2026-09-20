-- BECK moat layer v1
-- Purpose: preserve proprietary economic memory as evidence -> prediction -> outcome -> calibration.
-- Runtime schema was applied idempotently to Supabase before this migration was committed.

create table if not exists public.moat_evidence_observations (
  id uuid primary key default gen_random_uuid(),
  silo_id text not null,
  subject_ref text not null,
  source_family text not null,
  source_ref text,
  observation jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now(),
  integrity_hash text,
  independence_key text,
  verification_status text not null default 'UNVERIFIED',
  epistemic_tier text,
  created_at timestamptz not null default now()
);
create index if not exists moat_evidence_subject_idx on public.moat_evidence_observations(subject_ref);
create index if not exists moat_evidence_family_idx on public.moat_evidence_observations(source_family);
create index if not exists moat_evidence_independence_idx on public.moat_evidence_observations(subject_ref, independence_key);

create table if not exists public.moat_predictions (
  id uuid primary key default gen_random_uuid(),
  silo_id text not null,
  subject_ref text not null,
  prediction_type text not null,
  predicted_value jsonb not null,
  confidence numeric,
  evidence_ids uuid[] not null default '{}',
  predicted_at timestamptz not null default now(),
  check_at timestamptz,
  status text not null default 'OPEN',
  created_at timestamptz not null default now()
);
create index if not exists moat_predictions_subject_idx on public.moat_predictions(subject_ref);
create index if not exists moat_predictions_status_idx on public.moat_predictions(status);

create table if not exists public.moat_outcomes (
  id uuid primary key default gen_random_uuid(),
  prediction_id uuid references public.moat_predictions(id) on delete set null,
  subject_ref text not null,
  actual_value jsonb not null,
  outcome_at timestamptz not null default now(),
  evidence_ids uuid[] not null default '{}',
  verification_status text not null default 'UNVERIFIED',
  discrepancy jsonb,
  created_at timestamptz not null default now()
);
create index if not exists moat_outcomes_prediction_idx on public.moat_outcomes(prediction_id);
create index if not exists moat_outcomes_subject_idx on public.moat_outcomes(subject_ref);

create table if not exists public.moat_calibration (
  id uuid primary key default gen_random_uuid(),
  silo_id text not null,
  prediction_type text not null,
  confidence_bucket numeric not null,
  sample_count integer not null default 0,
  success_count integer not null default 0,
  empirical_rate numeric,
  calibration_error numeric,
  window_start timestamptz,
  window_end timestamptz,
  methodology_version text not null default 'v1',
  updated_at timestamptz not null default now(),
  unique (silo_id, prediction_type, confidence_bucket, methodology_version)
);
create index if not exists moat_calibration_lookup_idx on public.moat_calibration(silo_id, prediction_type, confidence_bucket);

alter table public.moat_evidence_observations enable row level security;
alter table public.moat_predictions enable row level security;
alter table public.moat_outcomes enable row level security;
alter table public.moat_calibration enable row level security;
