-- 777 Metal-Detector Scout: durable discovery evidence, separate from economic truth.
-- No scout record is a sale, settlement, fulfillment, or ledger event.
create table if not exists public.scout_runs (
  id uuid primary key default gen_random_uuid(),
  run_key text not null unique,
  trigger_source text not null default 'github_actions',
  status text not null default 'RUNNING' check (status in ('RUNNING','COMPLETE','PARTIAL','FAILED')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  source_results jsonb not null default '{}'::jsonb,
  harvested_count integer not null default 0 check (harvested_count >= 0),
  error_count integer not null default 0 check (error_count >= 0),
  summary_hash text
);

create table if not exists public.scout_findings (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  canonical_url text,
  raw_payload jsonb not null,
  evidence_hash text check (evidence_hash is null or evidence_hash ~ '^[0-9a-f]{64}  status text not null default 'STAGED'
    check (status in ('STAGED','CLASSIFIED','SCORED','REVIEW','VAULTED','DISCARDED','DEFERRED','ERROR')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  occurrence_count integer not null default 1 check (occurrence_count > 0),
  last_run_id uuid references public.scout_runs(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (source, payload_sha256)
);
create index if not exists scout_findings_status_seen_idx
  on public.scout_findings(status, last_seen_at desc);
create index if not exists scout_findings_url_idx
  on public.scout_findings(canonical_url) where canonical_url is not null;

create table if not exists public.scout_assessments (
  id uuid primary key default gen_random_uuid(),
  finding_id uuid not null references public.scout_findings(id) on delete cascade,
  taxonomy_class text not null check (taxonomy_class in ('COMPONENT','OPPORTUNITY','SIGNAL','ARTIFACT','CONNECTION','TOOL','PRICE')),
  tags jsonb not null default '[]'::jsonb,
  summary text not null,
  reuse_score integer not null check (reuse_score between 0 and 30),
  revenue_score integer not null check (revenue_score between 0 and 40),
  leverage_score integer not null check (leverage_score between 0 and 20),
  novelty_score integer not null check (novelty_score between 0 and 10),
  cost_penalty integer not null check (cost_penalty between 0 and 10),
  total_score integer generated always as (reuse_score + revenue_score + leverage_score + novelty_score - cost_penalty) stored,
  reason text not null,
  model_name text not null,
  model_mode text not null check (model_mode in ('LOCAL_LM_STUDIO','DETERMINISTIC','CLOUD_MODEL')),
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (finding_id)
);
create index if not exists scout_assessments_score_idx
  on public.scout_assessments(total_score desc, created_at desc);

create table if not exists public.scout_review_decisions (
  id uuid primary key default gen_random_uuid(),
  finding_id uuid not null references public.scout_findings(id) on delete restrict,
  assessment_id uuid references public.scout_assessments(id) on delete set null,
  decision text not null check (decision in ('PROMOTE','DISCARD','DEFER')),
  decided_by text not null,
  rationale text not null,
  decided_at timestamptz not null default now(),
  evidence_hash text not null check (evidence_hash ~ '^[0-9a-f]{64}$')
);
create index if not exists scout_review_decisions_recent_idx
  on public.scout_review_decisions(decided_at desc);

alter table public.scout_runs enable row level security;
alter table public.scout_findings enable row level security;
alter table public.scout_assessments enable row level security;
alter table public.scout_review_decisions enable row level security;

-- Only trusted server-side workers may access these tables until explicit,
-- purpose-built reviewer policies are implemented. Never expose service keys to models.
revoke all on public.scout_runs from anon, authenticated;
revoke all on public.scout_findings from anon, authenticated;
revoke all on public.scout_assessments from anon, authenticated;
revoke all on public.scout_review_decisions from anon, authenticated;
grant all on public.scout_runs to service_role;
grant all on public.scout_findings to service_role;
grant all on public.scout_assessments to service_role;
grant all on public.scout_review_decisions to service_role;

comment on table public.scout_runs is 'Durable run receipts for 777 Metal-Detector discovery. Not revenue evidence.';
comment on table public.scout_findings is 'Unfiltered raw discoveries with stable hashes; low scores never delete source evidence.';
comment on table public.scout_assessments is 'Non-authoritative classification and ranking; maximum total is 100 (reuse 30 + revenue 40 + leverage 20 + novelty 10, less cost penalty).';
comment on table public.scout_review_decisions is 'Explicit human review decisions for scout findings; separate from economic_ledger.';),
  evidence_signature text,
  evidence_canonical text,
  status text not null default 'STAGED'
    check (status in ('STAGED','CLASSIFIED','SCORED','REVIEW','VAULTED','DISCARDED','DEFERRED','ERROR')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  occurrence_count integer not null default 1 check (occurrence_count > 0),
  last_run_id uuid references public.scout_runs(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (source, payload_sha256)
);
create index if not exists scout_findings_status_seen_idx
  on public.scout_findings(status, last_seen_at desc);
create index if not exists scout_findings_url_idx
  on public.scout_findings(canonical_url) where canonical_url is not null;

create table if not exists public.scout_assessments (
  id uuid primary key default gen_random_uuid(),
  finding_id uuid not null references public.scout_findings(id) on delete cascade,
  taxonomy_class text not null check (taxonomy_class in ('COMPONENT','OPPORTUNITY','SIGNAL','ARTIFACT','CONNECTION','TOOL','PRICE')),
  tags jsonb not null default '[]'::jsonb,
  summary text not null,
  reuse_score integer not null check (reuse_score between 0 and 30),
  revenue_score integer not null check (revenue_score between 0 and 30),
  leverage_score integer not null check (leverage_score between 0 and 20),
  novelty_score integer not null check (novelty_score between 0 and 10),
  cost_penalty integer not null check (cost_penalty between 0 and 10),
  total_score integer generated always as (reuse_score + revenue_score + leverage_score + novelty_score - cost_penalty) stored,
  reason text not null,
  model_name text not null,
  model_mode text not null check (model_mode in ('LOCAL_LM_STUDIO','DETERMINISTIC','CLOUD_MODEL')),
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (finding_id)
);
create index if not exists scout_assessments_score_idx
  on public.scout_assessments(total_score desc, created_at desc);

create table if not exists public.scout_review_decisions (
  id uuid primary key default gen_random_uuid(),
  finding_id uuid not null references public.scout_findings(id) on delete restrict,
  assessment_id uuid references public.scout_assessments(id) on delete set null,
  decision text not null check (decision in ('PROMOTE','DISCARD','DEFER')),
  decided_by text not null,
  rationale text not null,
  decided_at timestamptz not null default now(),
  evidence_hash text not null check (evidence_hash ~ '^[0-9a-f]{64}$')
);
create index if not exists scout_review_decisions_recent_idx
  on public.scout_review_decisions(decided_at desc);

alter table public.scout_runs enable row level security;
alter table public.scout_findings enable row level security;
alter table public.scout_assessments enable row level security;
alter table public.scout_review_decisions enable row level security;

-- Only trusted server-side workers may access these tables until explicit,
-- purpose-built reviewer policies are implemented. Never expose service keys to models.
revoke all on public.scout_runs from anon, authenticated;
revoke all on public.scout_findings from anon, authenticated;
revoke all on public.scout_assessments from anon, authenticated;
revoke all on public.scout_review_decisions from anon, authenticated;
grant all on public.scout_runs to service_role;
grant all on public.scout_findings to service_role;
grant all on public.scout_assessments to service_role;
grant all on public.scout_review_decisions to service_role;

comment on table public.scout_runs is 'Durable run receipts for 777 Metal-Detector discovery. Not revenue evidence.';
comment on table public.scout_findings is 'Unfiltered raw discoveries with stable hashes; low scores never delete source evidence.';
comment on table public.scout_assessments is 'Non-authoritative classification and ranking; maximum total is 90, not 100.';
comment on table public.scout_review_decisions is 'Explicit human review decisions for scout findings; separate from economic_ledger.';