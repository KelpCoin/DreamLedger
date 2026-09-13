create table if not exists public.processed_webhook_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

create table if not exists public.evidence_artifacts (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  artifact_type text not null,
  artifact_ref text not null,
  content_hash text,
  created_at timestamptz not null default now(),
  unique(event_id, artifact_type, artifact_ref)
);

alter table public.processed_webhook_events enable row level security;
alter table public.evidence_artifacts enable row level security;

revoke all on public.processed_webhook_events from anon, authenticated;
revoke all on public.evidence_artifacts from anon, authenticated;

create index if not exists idx_evidence_artifacts_event_id
  on public.evidence_artifacts(event_id);
