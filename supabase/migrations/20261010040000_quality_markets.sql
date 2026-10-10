-- DreamLedger Quality Markets: private, evidence-first evaluator ledger.
-- Apply with the Supabase SQL Editor only after the database is writable.
-- These tables intentionally have RLS enabled and no client-facing policies.
-- Access is server-side only through a trusted service role / backend.

create extension if not exists pgcrypto;

create table if not exists public.evaluation_jobs (
  id uuid primary key default gen_random_uuid(),
  job_key text unique,
  subject_kind text not null check (subject_kind in ('url','file','api','claim','agent_delivery','other')),
  subject_ref text not null,
  acceptance_criteria jsonb not null default '[]'::jsonb
    check (jsonb_typeof(acceptance_criteria) = 'array'),
  source_manifest jsonb not null default '[]'::jsonb
    check (jsonb_typeof(source_manifest) = 'array'),
  status text not null default 'queued'
    check (status in ('queued','assigned','evaluating','needs_adjudication','adjudicated','closed','cancelled')),
  reference_verdict text
    check (reference_verdict is null or reference_verdict in ('pass','fail','needs_human_review','inconclusive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  adjudicated_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.evaluator_assignments (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.evaluation_jobs(id) on delete cascade,
  evaluator_key text not null,
  assignment_round integer not null default 1 check (assignment_round > 0),
  status text not null default 'assigned'
    check (status in ('assigned','accepted','submitted','abstained','expired','revoked')),
  assigned_at timestamptz not null default now(),
  submitted_at timestamptz,
  blind_assignment boolean not null default true,
  conflict_flags jsonb not null default '[]'::jsonb
    check (jsonb_typeof(conflict_flags) = 'array'),
  metadata jsonb not null default '{}'::jsonb,
  unique (job_id, evaluator_key, assignment_round)
);

create table if not exists public.evaluations (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null unique references public.evaluator_assignments(id) on delete cascade,
  verdict text not null
    check (verdict in ('pass','fail','needs_human_review','inconclusive')),
  criterion_results jsonb not null default '[]'::jsonb
    check (jsonb_typeof(criterion_results) = 'array'),
  evidence_refs jsonb not null default '[]'::jsonb
    check (jsonb_typeof(evidence_refs) = 'array'),
  rationale text not null,
  artifact_sha256 text
    check (artifact_sha256 is null or artifact_sha256 ~ '^[0-9a-fA-F]{64}$'),
  submitted_at timestamptz not null default now(),
  adjudication_status text not null default 'pending'
    check (adjudication_status in ('pending','accepted_as_reference','rejected','disputed')),
  adjudication_note text,
  adjudicated_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.evaluator_reputation_events (
  id uuid primary key default gen_random_uuid(),
  evaluator_key text not null,
  evaluation_id uuid references public.evaluations(id) on delete set null,
  job_id uuid references public.evaluation_jobs(id) on delete set null,
  event_kind text not null
    check (event_kind in ('agreement','disagreement','adjudication_bonus','collusion_flag','conflict_flag','manual_adjustment','reversal')),
  delta numeric(8,5) not null,
  weight numeric(8,5) not null default 1 check (weight >= 0 and weight <= 1),
  reference_verdict text
    check (reference_verdict is null or reference_verdict in ('pass','fail','needs_human_review','inconclusive')),
  evaluator_verdict text
    check (evaluator_verdict is null or evaluator_verdict in ('pass','fail','needs_human_review','inconclusive')),
  rationale text not null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists evaluation_jobs_status_created_idx
  on public.evaluation_jobs (status, created_at desc);
create index if not exists evaluator_assignments_job_status_idx
  on public.evaluator_assignments (job_id, status);
create index if not exists evaluator_assignments_evaluator_created_idx
  on public.evaluator_assignments (evaluator_key, assigned_at desc);
create index if not exists evaluations_adjudication_idx
  on public.evaluations (adjudication_status, submitted_at desc);
create index if not exists reputation_events_evaluator_created_idx
  on public.evaluator_reputation_events (evaluator_key, created_at desc);
create index if not exists reputation_events_job_idx
  on public.evaluator_reputation_events (job_id);

alter table public.evaluation_jobs enable row level security;
alter table public.evaluator_assignments enable row level security;
alter table public.evaluations enable row level security;
alter table public.evaluator_reputation_events enable row level security;

revoke all on public.evaluation_jobs from anon, authenticated;
revoke all on public.evaluator_assignments from anon, authenticated;
revoke all on public.evaluations from anon, authenticated;
revoke all on public.evaluator_reputation_events from anon, authenticated;
grant all on public.evaluation_jobs to service_role;
grant all on public.evaluator_assignments to service_role;
grant all on public.evaluations to service_role;
grant all on public.evaluator_reputation_events to service_role;
