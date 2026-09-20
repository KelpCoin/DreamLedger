create table if not exists public.dreamledger_telemetry_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  entity_type text,
  entity_id text,
  classification text,
  source text not null default 'system',
  occurred_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists dreamledger_telemetry_events_type_time_idx
  on public.dreamledger_telemetry_events(event_type, occurred_at desc);
create index if not exists dreamledger_telemetry_events_entity_idx
  on public.dreamledger_telemetry_events(entity_type, entity_id, occurred_at desc);
alter table public.dreamledger_telemetry_events enable row level security;
revoke all on public.dreamledger_telemetry_events from anon, authenticated;
