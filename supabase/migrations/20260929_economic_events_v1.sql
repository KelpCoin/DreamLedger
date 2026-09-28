-- Canonical event substrate. The production table may pre-exist, so this migration
-- adds missing canonical fields without deleting or rewriting existing records.

alter table public.economic_events add column if not exists event_id uuid default gen_random_uuid();
alter table public.economic_events add column if not exists correlation_id text;
alter table public.economic_events add column if not exists opportunity_id uuid;
alter table public.economic_events add column if not exists action_id uuid;
alter table public.economic_events add column if not exists packet_id uuid;
alter table public.economic_events add column if not exists event_type text;
alter table public.economic_events add column if not exists state_before text;
alter table public.economic_events add column if not exists state_after text;
alter table public.economic_events add column if not exists authorization_state text;
alter table public.economic_events add column if not exists settlement_state text;
alter table public.economic_events add column if not exists fulfillment_state text;
alter table public.economic_events add column if not exists verification_state text;
alter table public.economic_events add column if not exists source_system text;
alter table public.economic_events add column if not exists source_record_id text;
alter table public.economic_events add column if not exists evidence_refs jsonb default '[]'::jsonb;
alter table public.economic_events add column if not exists input_hash text;
alter table public.economic_events add column if not exists output_hash text;
alter table public.economic_events add column if not exists cost_nzd numeric;
alter table public.economic_events add column if not exists price_nzd numeric;
alter table public.economic_events add column if not exists dependency_state text;
alter table public.economic_events add column if not exists error_class text;
alter table public.economic_events add column if not exists occurred_at timestamptz default now();
alter table public.economic_events add column if not exists recorded_at timestamptz default now();
alter table public.economic_events add column if not exists metadata jsonb default '{}'::jsonb;

create index if not exists economic_events_type_time_idx
  on public.economic_events (event_type, occurred_at desc);

create index if not exists economic_events_correlation_idx
  on public.economic_events (correlation_id);

create index if not exists economic_events_opportunity_idx
  on public.economic_events (opportunity_id);

alter table public.economic_events enable row level security;

comment on table public.economic_events is
  'Append-oriented canonical economic event stream. Observations are not economic truth unless verification predicates pass.';
