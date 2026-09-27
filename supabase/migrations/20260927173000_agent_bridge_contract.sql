-- Governed bridge around existing CUBE/Elohim/Gauntlet/Truth primitives.
-- This is additive. It does not auto-enable or rewrite legacy RLS policies.

create table if not exists public.agent_bridge_runs (
  id uuid primary key default gen_random_uuid(),
  correlation_id text not null unique,
  tenant_id uuid,
  silo_id text,
  workload text not null,
  signal_ref text,
  cube_ref text,
  elohim_ref text,
  gauntlet_ref text,
  approval_ref text,
  action_ref uuid,
  truth_ref text,
  state text not null default 'RECEIVED'
    check (state in ('RECEIVED','QUALIFIED','PROPOSED','GATE_PENDING','AUTHORIZED','EXECUTING','OBSERVING','VERIFYING','VERIFIED','REJECTED','FAILED','EXPIRED')),
  capability text not null,
  actor_type text not null check (actor_type in ('USER','AGENT','SYSTEM','WEBHOOK')),
  actor_id text,
  input_hash text,
  policy_version text,
  gauntlet_policy_version text,
  idempotency_key text not null,
  requested_external_effect text,
  approval_state text not null default 'NOT_REQUIRED'
    check (approval_state in ('NOT_REQUIRED','PENDING','APPROVED','REJECTED')),
  evidence_refs jsonb not null default '[]'::jsonb,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workload, idempotency_key)
);

create index if not exists agent_bridge_runs_state_idx
  on public.agent_bridge_runs(state, updated_at desc);

create index if not exists agent_bridge_runs_silo_idx
  on public.agent_bridge_runs(silo_id, created_at desc);

create table if not exists public.agent_bridge_transitions (
  id uuid primary key default gen_random_uuid(),
  bridge_run_id uuid not null references public.agent_bridge_runs(id) on delete cascade,
  from_state text,
  to_state text not null,
  actor_type text not null,
  actor_id text,
  policy_version text,
  reason text,
  evidence_refs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists agent_bridge_transitions_run_idx
  on public.agent_bridge_transitions(bridge_run_id, created_at);

create table if not exists public.agent_bridge_proposals (
  id uuid primary key default gen_random_uuid(),
  bridge_run_id uuid not null references public.agent_bridge_runs(id) on delete cascade,
  proposer text not null default 'ELOHIM',
  proposal_type text not null,
  target_type text,
  target_id text,
  expected_effect text,
  inputs jsonb not null default '{}'::jsonb,
  reasoning_refs jsonb not null default '[]'::jsonb,
  status text not null default 'PROPOSED'
    check (status in ('PROPOSED','GATE_PENDING','AUTHORIZED','REJECTED','EXPIRED')),
  created_at timestamptz not null default now()
);

create table if not exists public.agent_bridge_gate_results (
  id uuid primary key default gen_random_uuid(),
  bridge_run_id uuid not null references public.agent_bridge_runs(id) on delete cascade,
  gate text not null default 'GAUNTLET',
  verdict text not null check (verdict in ('PASS','FAIL','HOLD')),
  policy_version text,
  checks jsonb not null default '[]'::jsonb,
  contradictions jsonb not null default '[]'::jsonb,
  authority jsonb not null default '{}'::jsonb,
  required_human_gate boolean not null default false,
  certificate_ref text,
  created_at timestamptz not null default now()
);

create table if not exists public.agent_bridge_observations (
  id uuid primary key default gen_random_uuid(),
  bridge_run_id uuid not null references public.agent_bridge_runs(id) on delete cascade,
  external_system text not null,
  external_reference text,
  request_hash text,
  observed_state text,
  observation jsonb not null default '{}'::jsonb,
  evidence_hash text,
  observed_at timestamptz not null default now()
);

create index if not exists agent_bridge_observations_run_idx
  on public.agent_bridge_observations(bridge_run_id, observed_at);

create table if not exists public.agent_bridge_truth_verdicts (
  id uuid primary key default gen_random_uuid(),
  bridge_run_id uuid not null references public.agent_bridge_runs(id) on delete cascade,
  verdict text not null check (verdict in ('VERIFIED','UNVERIFIED','CONTRADICTED','STALE','TEST','SIMULATED','INTERNAL','UNMATCHED')),
  independent_external_actor boolean not null default false,
  settled_payment boolean not null default false,
  fulfillment_evidence boolean not null default false,
  external_effect_evidence boolean not null default false,
  source_refs jsonb not null default '[]'::jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists agent_bridge_truth_run_idx
  on public.agent_bridge_truth_verdicts(bridge_run_id, created_at desc);

create or replace function public.agent_bridge_transition(
  p_bridge_run_id uuid,
  p_to_state text,
  p_actor_type text,
  p_actor_id text,
  p_reason text,
  p_policy_version text,
  p_evidence_refs jsonb default '[]'::jsonb
)
returns void
language plpgsql
security invoker
as $$
declare
  v_from text;
begin
  select state into v_from
  from public.agent_bridge_runs
  where id = p_bridge_run_id
  for update;

  if v_from is null then
    raise exception 'BRIDGE_RUN_NOT_FOUND';
  end if;

  if v_from = p_to_state then
    return;
  end if;

  if not (
    (v_from='RECEIVED' and p_to_state='QUALIFIED') or
    (v_from='QUALIFIED' and p_to_state='PROPOSED') or
    (v_from='PROPOSED' and p_to_state in ('GATE_PENDING','REJECTED')) or
    (v_from='GATE_PENDING' and p_to_state in ('AUTHORIZED','REJECTED','EXPIRED')) or
    (v_from='AUTHORIZED' and p_to_state='EXECUTING') or
    (v_from='EXECUTING' and p_to_state in ('OBSERVING','FAILED')) or
    (v_from='OBSERVING' and p_to_state='VERIFYING') or
    (v_from='VERIFYING' and p_to_state in ('VERIFIED','FAILED')) or
    (v_from='RECEIVED' and p_to_state='FAILED') or
    (v_from='QUALIFIED' and p_to_state='FAILED') or
    (v_from='AUTHORIZED' and p_to_state='FAILED')
  ) then
    raise exception 'INVALID_BRIDGE_TRANSITION:%->%', v_from, p_to_state;
  end if;

  update public.agent_bridge_runs
  set state=p_to_state, updated_at=now()
  where id=p_bridge_run_id;

  insert into public.agent_bridge_transitions
    (bridge_run_id, from_state, to_state, actor_type, actor_id, policy_version, reason, evidence_refs)
  values
    (p_bridge_run_id, v_from, p_to_state, p_actor_type, p_actor_id, p_policy_version, p_reason, p_evidence_refs);
end;
$$;

comment on function public.agent_bridge_transition is
'Governed bridge transition. Intentionally SECURITY INVOKER; privileged workers should use server-side credentials and existing policy controls.';
