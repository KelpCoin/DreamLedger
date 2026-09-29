-- REVENUE GATEWAY CONFIGURATION ONLY.
-- This table is configuration/control state, not an economic ledger.
-- LIVE_SCHEMA_REQUIRED: verified against current DreamLedger schema before application.
-- Safe commercial default: REFUSED until live capability and contract alignment are verified.

create table if not exists public.revenue_gateway_config (
  sku text primary key,
  service_promise text not null default 'REFUSED'
    check (service_promise in ('FULL','REDUCED','QUEUED','REFUSED')),
  current_mode text not null default 'REFUSED'
    check (current_mode in ('FULL','REDUCED','QUEUED','REFUSED')),
  degraded_mode text not null default 'NORMAL'
    check (degraded_mode in ('NORMAL','DEGRADED_FALLBACK','DEGRADED_QUEUE')),
  fallback_path text,
  can_accept_payment boolean not null default false,
  expected_delivery text not null,
  evidence_required boolean not null default true,
  config_version integer not null default 1 check (config_version > 0),
  failure_threshold integer not null default 1 check (failure_threshold >= 1),
  sustained_failure_seconds integer not null default 0 check (sustained_failure_seconds >= 0),
  health_ttl_seconds integer not null default 300 check (health_ttl_seconds >= 0),
  queue_capacity integer not null default 0 check (queue_capacity >= 0),
  queue_max_age_seconds integer not null default 0 check (queue_max_age_seconds >= 0),
  health_summary jsonb not null default '{}'::jsonb,
  last_health_check_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint revenue_gateway_acceptance_guard check (
    (can_accept_payment and current_mode in ('FULL','REDUCED'))
    or
    (not can_accept_payment)
  ),
  constraint revenue_gateway_queue_guard check (
    current_mode <> 'QUEUED'
    or queue_capacity > 0
  ),
  constraint revenue_gateway_reduced_guard check (
    current_mode <> 'REDUCED'
    or fallback_path is not null
  )
);

comment on table public.revenue_gateway_config is
  'Configuration/control boundary for commercial payment eligibility. Not a revenue ledger and never proof of economic outcome.';
comment on column public.revenue_gateway_config.service_promise is
  'Declared commercial promise. Must not be silently changed by degraded technical mode.';
comment on column public.revenue_gateway_config.current_mode is
  'Current technical fulfillment mode. REFUSED is the fail-closed default.';
comment on column public.revenue_gateway_config.can_accept_payment is
  'Policy decision only. Does not create or verify a payment.';
comment on column public.revenue_gateway_config.health_summary is
  'Last capability observations. Never treated as economic evidence.';
comment on column public.revenue_gateway_config.last_health_check_at is
  'Timestamp of last capability observation; freshness is governed by health_ttl_seconds.';

insert into public.revenue_gateway_config (
  sku,
  service_promise,
  current_mode,
  degraded_mode,
  fallback_path,
  can_accept_payment,
  expected_delivery,
  evidence_required,
  config_version
)
values (
  'QUOTE-COMPARE-49',
  'FULL',
  'REFUSED',
  'NORMAL',
  null,
  false,
  'Digital normalized comparison of 2-5 supplier quotations after verified settlement and successful fulfillment.',
  true,
  1
)
on conflict (sku) do nothing;

alter table public.revenue_gateway_config enable row level security;

-- No public/authenticated policy is created here.
-- The Edge Function reads this control table with its server-side client.
-- LIVE_SCHEMA_REQUIRED: verify whether an existing internal policy convention
-- requires a narrower policy before exposing this table through the Data API.
