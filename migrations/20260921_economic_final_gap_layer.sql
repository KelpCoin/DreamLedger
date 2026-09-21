begin;

alter table public.commerce_cells
  add column if not exists canonical_state text,
  add column if not exists economic_object jsonb not null default '{}'::jsonb,
  add column if not exists buyer jsonb not null default '{}'::jsonb,
  add column if not exists demand_signal jsonb not null default '{}'::jsonb,
  add column if not exists offer jsonb not null default '{}'::jsonb,
  add column if not exists attribution jsonb not null default '{}'::jsonb,
  add column if not exists evidence_requirements jsonb not null default '{}'::jsonb,
  add column if not exists verification_rules jsonb not null default '{}'::jsonb,
  add column if not exists human_authority_requirements jsonb not null default '{}'::jsonb,
  add column if not exists external_actuator_requirements jsonb not null default '{}'::jsonb,
  add column if not exists success_condition jsonb not null default '{}'::jsonb,
  add column if not exists failure_condition jsonb not null default '{}'::jsonb,
  add column if not exists replication_evidence jsonb not null default '{}'::jsonb,
  add column if not exists human_attention jsonb not null default '{}'::jsonb;

update public.commerce_cells
set canonical_state = case
  when state = 'BLOCKED' then 'BLOCKED'
  when verified_checkout and verified_fulfillment and verified_webhook then 'READY'
  else 'WATCH'
end
where canonical_state is null;

alter table public.commerce_cells
  alter column canonical_state set default 'WATCH';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'commerce_cells_canonical_state_check'
  ) then
    alter table public.commerce_cells add constraint commerce_cells_canonical_state_check
      check (canonical_state in ('WATCH','READY','ACTIVE','BLOCKED','QUARANTINED','VERIFIED','REPLICABLE'));
  end if;
end $$;

alter table public.economic_actions
  add column if not exists cell_id uuid,
  add column if not exists actor text,
  add column if not exists target text,
  add column if not exists payload jsonb not null default '{}'::jsonb,
  add column if not exists authorization_state text not null default 'AUTHORITY_REQUIRED',
  add column if not exists credential_requirement text,
  add column if not exists idempotency_key text,
  add column if not exists expires_at timestamptz,
  add column if not exists execution_state text not null default 'PREPARED',
  add column if not exists external_reference text,
  add column if not exists evidence_reference text,
  add column if not exists authorization_request jsonb not null default '{}'::jsonb,
  add column if not exists actuator_id text,
  add column if not exists rejection_reason text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='economic_actions_authorization_state_check') then
    alter table public.economic_actions add constraint economic_actions_authorization_state_check
      check (authorization_state in ('NONE','AUTHORITY_REQUIRED','AUTHORIZED','REJECTED','EXPIRED'));
  end if;
  if not exists (select 1 from pg_constraint where conname='economic_actions_execution_state_check') then
    alter table public.economic_actions add constraint economic_actions_execution_state_check
      check (execution_state in ('PREPARED','AUTHORITY_REQUIRED','AUTHORIZED','ACTUATOR_UNAVAILABLE','EXECUTING','SUCCEEDED','FAILED','EXPIRED','REJECTED'));
  end if;
end $$;

create unique index if not exists economic_actions_idempotency_key_uq
  on public.economic_actions(idempotency_key)
  where idempotency_key is not null;

alter table public.economic_events
  add column if not exists actor text not null default 'unknown',
  add column if not exists event_timestamp timestamptz not null default now(),
  add column if not exists source text not null default 'unknown',
  add column if not exists external_reference text,
  add column if not exists payload_hash text,
  add column if not exists prior_state text,
  add column if not exists resulting_state text,
  add column if not exists evidence jsonb not null default '{}'::jsonb,
  add column if not exists verification_status text not null default 'UNVERIFIED',
  add column if not exists observation_mode text not null default 'ASSERTED',
  add column if not exists scope text not null default 'INTERNAL';

do $$
begin
  if not exists (select 1 from pg_constraint where conname='economic_events_verification_status_check') then
    alter table public.economic_events add constraint economic_events_verification_status_check
      check (verification_status in ('VERIFIED','UNVERIFIED','CONTRADICTED','STALE','TEST','SIMULATED','INTERNAL','UNMATCHED'));
  end if;
  if not exists (select 1 from pg_constraint where conname='economic_events_observation_mode_check') then
    alter table public.economic_events add constraint economic_events_observation_mode_check
      check (observation_mode in ('OBSERVED','ASSERTED'));
  end if;
  if not exists (select 1 from pg_constraint where conname='economic_events_scope_check') then
    alter table public.economic_events add constraint economic_events_scope_check
      check (scope in ('EXTERNAL','INTERNAL'));
  end if;
end $$;

create table if not exists public.economic_attribution (
  attribution_id uuid primary key default gen_random_uuid(),
  cell_id uuid references public.commerce_cells(cell_id) on delete set null,
  action_id uuid references public.economic_actions(action_id) on delete set null,
  outcome_id uuid references public.economic_outcomes(outcome_id) on delete set null,
  discovery_id text,
  offer_id text,
  session_id text,
  transaction_id text,
  payment_id text,
  fulfillment_id text,
  outcome_id_external text,
  attribution_status text not null default 'UNMATCHED',
  attribution_method text not null default 'EXPLICIT_ID',
  observed_at timestamptz not null default now(),
  evidence_reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (attribution_status in ('VERIFIED','UNVERIFIED','CONTRADICTED','STALE','TEST','SIMULATED','INTERNAL','UNMATCHED'))
);

create unique index if not exists economic_attribution_chain_uq
  on public.economic_attribution(session_id, transaction_id, payment_id)
  where session_id is not null or transaction_id is not null or payment_id is not null;

create table if not exists public.economic_actuators (
  actuator_id text primary key,
  action_types text[] not null default '{}',
  status text not null default 'ACTUATOR_UNAVAILABLE',
  credential_requirement text,
  external_system text,
  last_observed_at timestamptz,
  evidence_reference text,
  metadata jsonb not null default '{}'::jsonb,
  check (status in ('ACTUATOR_UNAVAILABLE','AVAILABLE','DEGRADED','DISABLED'))
);

insert into public.economic_actuators(actuator_id,action_types,status,credential_requirement,external_system,metadata)
values
 ('stripe_checkout',ARRAY['CREATE_CHECKOUT'],'AVAILABLE','Stripe account authorization','Stripe','{"mode":"live","observed":true}'::jsonb),
 ('generic_external_action',ARRAY[]::text[],'ACTUATOR_UNAVAILABLE','Platform-specific credential/connection','external','{}'::jsonb)
on conflict (actuator_id) do nothing;

create table if not exists public.economic_human_interventions (
  intervention_id uuid primary key default gen_random_uuid(),
  cell_id uuid references public.commerce_cells(cell_id) on delete set null,
  action_id uuid references public.economic_actions(action_id) on delete set null,
  intervention_type text not null,
  reason text not null,
  occurred_at timestamptz not null default now(),
  actor text not null,
  reversible boolean,
  evidence_reference text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.economic_replication (
  replication_id uuid primary key default gen_random_uuid(),
  cell_id uuid not null references public.commerce_cells(cell_id) on delete cascade,
  transaction_id text not null,
  buyer_key_hash text not null,
  offer_id text,
  channel text,
  fulfillment_reference text,
  human_intervention_count integer not null default 0,
  evidence_ids text[] not null default '{}',
  outcome_status text not null default 'UNVERIFIED',
  observed_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  unique(cell_id, transaction_id),
  check (outcome_status in ('VERIFIED','UNVERIFIED','CONTRADICTED','STALE','TEST','SIMULATED','INTERNAL','UNMATCHED'))
);

alter table public.fulfillment_requests
  add column if not exists canonical_state text,
  add column if not exists manual_fulfillment boolean not null default false,
  add column if not exists fulfillment_reference text,
  add column if not exists confirmation_reference text,
  add column if not exists evidence_reference text,
  add column if not exists evidence_status text not null default 'UNVERIFIED';

update public.fulfillment_requests
set canonical_state = case
  when lower(status) in ('queued','pending') then 'FULFILLMENT_REQUIRED'
  when lower(status) in ('processing','executing') then 'FULFILLMENT_EXECUTING'
  when lower(status) in ('fulfilled','completed','delivered') then 'FULFILLED'
  else 'FULFILLMENT_REQUIRED'
end
where canonical_state is null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='fulfillment_requests_canonical_state_check') then
    alter table public.fulfillment_requests add constraint fulfillment_requests_canonical_state_check
      check (canonical_state in ('PAYMENT_SETTLED','FULFILLMENT_REQUIRED','FULFILLMENT_EXECUTING','FULFILLED','CONFIRMATION','EVIDENCE','FAILED','REFUNDED'));
  end if;
end $$;

alter table public.control_experiments
  add column if not exists cell_id uuid,
  add column if not exists target text,
  add column if not exists offer text,
  add column if not exists channel text,
  add column if not exists action jsonb not null default '{}'::jsonb,
  add column if not exists evidence_requirements jsonb not null default '{}'::jsonb,
  add column if not exists start_at timestamptz,
  add column if not exists end_at timestamptz,
  add column if not exists result jsonb not null default '{}'::jsonb,
  add column if not exists next_action text;

create table if not exists public.economic_agent_events (
  event_id uuid primary key default gen_random_uuid(),
  agent_id text not null,
  task_id text not null,
  verb text not null,
  capability text,
  objective text,
  constraints jsonb not null default '{}'::jsonb,
  authorization_context jsonb not null default '{}'::jsonb,
  input_evidence jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  timestamp timestamptz not null default now(),
  idempotency_key text,
  check (verb in ('OBS','REQ','ACK','ACT','DONE','FAIL'))
);

create unique index if not exists economic_agent_events_idempotency_uq
  on public.economic_agent_events(idempotency_key)
  where idempotency_key is not null;

create or replace view public.economic_control_report as
with verified as (
  select
    count(*) filter (where truth_status='VERIFIED')::bigint as verified_events,
    coalesce(sum(amount_nzd) filter (where truth_status='VERIFIED'),0)::numeric as verified_revenue_nzd,
    count(distinct attribution->>'buyer_key') filter (where truth_status='VERIFIED' and coalesce(attribution->>'buyer_key','')<>'')::bigint as independent_buyers,
    max(observed_at) filter (where truth_status='VERIFIED') as last_verified_at
  from public.economic_outcomes
),
cells as (
  select
    count(*) filter (where canonical_state='READY')::bigint ready_cells,
    count(*) filter (where canonical_state='ACTIVE')::bigint active_cells,
    count(*) filter (where canonical_state='BLOCKED')::bigint blocked_cells,
    count(*) filter (where canonical_state='QUARANTINED')::bigint quarantined_cells,
    count(*) filter (where canonical_state='REPLICABLE')::bigint replicable_cells
  from public.commerce_cells
),
human as (
  select count(*)::bigint interventions from public.economic_human_interventions
),
act as (
  select count(*) filter (where status='AVAILABLE')::bigint available,
         count(*) filter (where status='ACTUATOR_UNAVAILABLE')::bigint unavailable
  from public.economic_actuators
)
select
  'ECONOMIC_CONTROL_REPORT_V1'::text as report_schema,
  case when verified.verified_events > 0 then 'VERIFIED' else 'UNVERIFIED' end as current_state,
  verified.verified_revenue_nzd as verified_revenue,
  verified.verified_events as verified_payments,
  verified.independent_buyers,
  cells.active_cells as active_cell_count,
  cells.ready_cells,
  cells.quarantined_cells,
  cells.replicable_cells,
  verified.last_verified_at,
  act.available as actuators_available,
  act.unavailable as actuators_unavailable,
  human.interventions as human_interventions,
  (select count(*) from public.economic_actions where execution_state in ('PREPARED','AUTHORITY_REQUIRED','AUTHORIZED'))::bigint as pending_actions,
  (select count(*) from public.economic_actions where execution_state='SUCCEEDED')::bigint as succeeded_actions,
  (select count(*) from public.economic_actions where execution_state='ACTUATOR_UNAVAILABLE')::bigint as actuator_blocked_actions;

commit;