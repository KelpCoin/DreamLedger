create table if not exists public.economic_events (
  event_id uuid primary key default gen_random_uuid(),
  correlation_id text,
  opportunity_id uuid,
  action_id uuid,
  packet_id uuid,
  event_type text not null,
  state_before text,
  state_after text,
  authorization_state text,
  settlement_state text,
  fulfillment_state text,
  verification_state text,
  source_system text not null,
  source_record_id text,
  evidence_refs jsonb not null default '[]'::jsonb,
  input_hash text,
  output_hash text,
  cost_nzd numeric,
  price_nzd numeric,
  dependency_state text,
  error_class text,
  occurred_at timestamptz not null default now(),
  recorded_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists economic_events_type_time_idx
  on public.economic_events (event_type, occurred_at desc);

create index if not exists economic_events_correlation_idx
  on public.economic_events (correlation_id);

create index if not exists economic_events_opportunity_idx
  on public.economic_events (opportunity_id);

alter table public.economic_events enable row level security;

comment on table public.economic_events is
  'Append-oriented canonical economic event stream. Observations are not economic truth unless verification predicates pass.';
