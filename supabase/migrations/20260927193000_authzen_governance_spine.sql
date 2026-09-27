-- Batch 15 governance architecture.
-- AuthZEN-style SARC PDP, authority attenuation, decision non-bypassability,
-- explicit RLS rejection policies, and evidence completeness.
-- This migration is intentionally additive and is NOT production-applied by this commit.

create table if not exists public.economic_authorization_decisions (
  decision_id uuid primary key default gen_random_uuid(),
  trace_id uuid not null default gen_random_uuid(),
  request_hash text not null,
  subject jsonb not null,
  action jsonb not null,
  resource jsonb not null,
  context jsonb not null default '{}'::jsonb,
  verdict text not null check (verdict in ('allow','deny','needs_approval')),
  policy_version text not null,
  reasons jsonb not null default '[]'::jsonb,
  obligations jsonb not null default '[]'::jsonb,
  source_excluded boolean not null default false,
  authority_chain jsonb not null default '[]'::jsonb,
  spend_limit_nzd numeric,
  requested_cost_nzd numeric not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists economic_authorization_decisions_request_hash_idx
  on public.economic_authorization_decisions(request_hash);

create index if not exists economic_authorization_decisions_trace_idx
  on public.economic_authorization_decisions(trace_id);

alter table public.economic_authorization_decisions enable row level security;
alter table public.economic_authorization_decisions force row level security;
revoke all on public.economic_authorization_decisions from anon, authenticated;
grant select, insert on public.economic_authorization_decisions to service_role;

drop policy if exists "service_role economic authorization decisions" on public.economic_authorization_decisions;
create policy "service_role economic authorization decisions"
  on public.economic_authorization_decisions
  for all to service_role
  using (true)
  with check (true);

alter table public.economic_execution_packets
  add column if not exists authorization_decision_id uuid,
  add column if not exists authorization_trace_id uuid,
  add column if not exists authorization_verdict text,
  add column if not exists authorization_request_hash text,
  add column if not exists authority_chain jsonb not null default '[]'::jsonb,
  add column if not exists governance_tier integer;

create index if not exists economic_execution_packets_authorization_decision_idx
  on public.economic_execution_packets(authorization_decision_id);

create index if not exists economic_execution_packets_authorization_trace_idx
  on public.economic_execution_packets(authorization_trace_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='economic_execution_packets_authorization_decision_fk'
  ) then
    alter table public.economic_execution_packets
      add constraint economic_execution_packets_authorization_decision_fk
      foreign key (authorization_decision_id)
      references public.economic_authorization_decisions(decision_id);
  end if;
end $$;

-- Authority is a capability lattice. A child may only narrow scope, spend,
-- time, and delegation depth. This table is a durable representation of the
-- delegation edge used by the PDP and later actuator verification.
create table if not exists public.economic_authority_delegations (
  delegation_id uuid primary key default gen_random_uuid(),
  parent_principal text not null,
  child_principal text not null,
  scope jsonb not null default '[]'::jsonb,
  parent_scope jsonb not null default '[]'::jsonb,
  spend_limit_nzd numeric not null default 0,
  parent_spend_limit_nzd numeric not null default 0,
  delegation_depth integer not null default 0,
  parent_max_depth integer not null default 0,
  valid_until timestamptz,
  revoked_at timestamptz,
  chain_hash text not null,
  created_at timestamptz not null default now(),
  check (spend_limit_nzd >= 0),
  check (parent_spend_limit_nzd >= 0),
  check (delegation_depth >= 0),
  check (parent_max_depth >= 0),
  check (spend_limit_nzd <= parent_spend_limit_nzd),
  check (delegation_depth <= parent_max_depth)
);

alter table public.economic_authority_delegations enable row level security;
alter table public.economic_authority_delegations force row level security;
revoke all on public.economic_authority_delegations from anon, authenticated;
grant select, insert, update on public.economic_authority_delegations to service_role;

drop policy if exists "service_role economic authority delegations" on public.economic_authority_delegations;
create policy "service_role economic authority delegations"
  on public.economic_authority_delegations
  for all to service_role
  using (true)
  with check (true);

-- Canonical AuthZEN/COAZ-shaped decision seam.
-- Subject, Action, Resource, Context are preserved verbatim in the decision
-- record so the PEP can audit exactly what the PDP evaluated.
create or replace function public.evaluate_economic_authorization(
  p_subject jsonb,
  p_action jsonb,
  p_resource jsonb,
  p_context jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_decision_id uuid := gen_random_uuid();
  v_trace_id uuid := gen_random_uuid();
  v_hash text;
  v_exclusion record;
  v_policy jsonb;
  v_verdict text := 'deny';
  v_reasons jsonb := '[]'::jsonb;
  v_obligations jsonb := '[]'::jsonb;
  v_source text;
  v_category text;
  v_action_type text;
  v_cost numeric := 0;
  v_reversible boolean := true;
  v_scope jsonb := coalesce(p_context->'authority_scope','[]'::jsonb);
  v_authority_chain jsonb := coalesce(p_context->'authority_chain','[]'::jsonb);
  v_spend_limit numeric;
  v_depth integer := coalesce((p_context->>'delegation_depth')::integer,0);
  v_max_depth integer := coalesce((p_context->>'max_delegation_depth')::integer,0);
  v_canonical text;
begin
  if jsonb_typeof(coalesce(p_subject,'null'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_action,'null'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_resource,'null'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_context,'{}'::jsonb)) <> 'object'
  then
    raise exception 'authorization request must contain JSON objects for SARC';
  end if;

  v_source := coalesce(nullif(p_action->>'source',''),nullif(p_action->>'source_ref',''),nullif(p_action->>'channel',''));
  v_category := coalesce(p_action->>'category','general');
  v_action_type := coalesce(p_action->>'action_type','UNKNOWN');
  v_cost := greatest(0,coalesce((p_action->>'cost_nzd')::numeric,(p_action->>'max_cost_nzd')::numeric,0));
  v_reversible := coalesce((p_action->>'reversible')::boolean,true);
  v_spend_limit := nullif(p_context->>'spend_limit_nzd','')::numeric;

  -- Hard deny has precedence over every policy or approval.
  select * into v_exclusion
  from public.check_source_exclusion(v_source,v_category,p_action)
  limit 1;

  if coalesce(v_exclusion.excluded,false) then
    v_reasons := jsonb_build_array(jsonb_build_object(
      'code','SOURCE_EXCLUDED',
      'reason',v_exclusion.reason,
      'exclusion_id',v_exclusion.exclusion_id
    ));
    v_verdict := 'deny';
  else
    -- Reuse the existing economic policy store as the policy source.
    v_policy := public.authorize_economic_action(
      v_action_type,
      v_cost,
      v_category,
      v_reversible
    );

    if coalesce(v_spend_limit, null) is not null and v_cost > v_spend_limit then
      v_reasons := jsonb_build_array(jsonb_build_object(
        'code','SPEND_LIMIT_EXCEEDED',
        'requested_nzd',v_cost,
        'limit_nzd',v_spend_limit
      ));
      v_verdict := 'deny';
    elsif v_max_depth > 0 and v_depth >= v_max_depth then
      v_reasons := jsonb_build_array(jsonb_build_object(
        'code','DELEGATION_DEPTH_EXCEEDED',
        'depth',v_depth,
        'max_depth',v_max_depth
      ));
      v_verdict := 'deny';
    elsif jsonb_array_length(v_scope) > 0
      and not exists (
        select 1
        from jsonb_array_elements_text(v_scope) s
        where s = v_action_type
      )
    then
      v_reasons := jsonb_build_array(jsonb_build_object(
        'code','SCOPE_NOT_DELEGATED',
        'action_type',v_action_type
      ));
      v_verdict := 'deny';
    elsif coalesce((v_policy->>'lane'),'RED') = 'GREEN'
      and coalesce((v_policy->>'authorized')::boolean,false)
    then
      v_verdict := 'allow';
      v_reasons := jsonb_build_array(jsonb_build_object(
        'code','POLICY_MATCH',
        'policy_version',coalesce(v_policy->>'policy_version','unknown')
      ));
    elsif coalesce((v_policy->>'lane'),'RED') = 'AMBER'
      or coalesce((v_policy->>'human_approval_required')::boolean,false)
    then
      v_verdict := 'needs_approval';
      v_reasons := jsonb_build_array(jsonb_build_object(
        'code','HUMAN_APPROVAL_REQUIRED',
        'policy_version',coalesce(v_policy->>'policy_version','unknown')
      ));
      v_obligations := jsonb_build_array(jsonb_build_object(
        'type','HUMAN_APPROVAL',
        're_evaluate_after_approval',true
      ));
    else
      v_verdict := 'deny';
      v_reasons := jsonb_build_array(jsonb_build_object(
        'code',coalesce(v_policy->>'reason','NO_POLICY')
      ));
    end if;
  end if;

  v_canonical := jsonb_build_object(
    'subject',p_subject,
    'action',p_action,
    'resource',p_resource,
    'context',p_context,
    'verdict',v_verdict,
    'policy_version',coalesce(v_policy->>'policy_version','exclusion-gate-v1')
  )::text;

  v_hash := encode(extensions.digest(convert_to(v_canonical,'utf8'),'sha256'),'hex');

  insert into public.economic_authorization_decisions(
    decision_id,trace_id,request_hash,subject,action,resource,context,
    verdict,policy_version,reasons,obligations,source_excluded,
    authority_chain,spend_limit_nzd,requested_cost_nzd
  )
  values(
    v_decision_id,v_trace_id,v_hash,p_subject,p_action,p_resource,p_context,
    v_verdict,coalesce(v_policy->>'policy_version','exclusion-gate-v1'),
    v_reasons,v_obligations,coalesce(v_exclusion.excluded,false),
    v_authority_chain,v_spend_limit,v_cost
  );

  return jsonb_build_object(
    'decision_id',v_decision_id,
    'trace_id',v_trace_id,
    'request_hash',v_hash,
    'verdict',v_verdict,
    'authorized',v_verdict='allow',
    'needs_approval',v_verdict='needs_approval',
    'policy_version',coalesce(v_policy->>'policy_version','exclusion-gate-v1'),
    'reasons',v_reasons,
    'obligations',v_obligations,
    'source_excluded',coalesce(v_exclusion.excluded,false),
    'authority_chain',v_authority_chain
  );
end;
$function$;

revoke all on function public.evaluate_economic_authorization(jsonb,jsonb,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.evaluate_economic_authorization(jsonb,jsonb,jsonb,jsonb) to service_role;

-- The old human-approval function is not an authorization bypass. It issues a
-- scoped approval record only. Consumption must re-evaluate the PDP.
create or replace function public.economic_issue_action_authorization(
  p_packet_id uuid,
  p_approver_id text,
  p_decision text,
  p_ttl_seconds integer default 300
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $function$
declare
  v_hash text;
  v_token text;
  v_id uuid;
  v_exp timestamptz;
  v_packet public.economic_execution_packets%rowtype;
  v_recheck jsonb;
begin
  if p_approver_id is null or btrim(p_approver_id)='' then raise exception 'approver required'; end if;
  if p_decision not in ('APPROVE','DENY') then raise exception 'decision must be APPROVE or DENY'; end if;
  if p_ttl_seconds < 30 or p_ttl_seconds > 3600 then raise exception 'ttl must be 30..3600 seconds'; end if;

  select * into v_packet from public.economic_execution_packets where packet_id=p_packet_id;
  if not found then raise exception 'packet not found'; end if;

  -- Approval is never a policy bypass. Re-evaluate the exact SARC request
  -- before recording the approval.
  select public.evaluate_economic_authorization(
    jsonb_build_object(
      'principal',p_approver_id,
      'delegated_from',coalesce(v_packet.authority_policy->'authority_chain','[]'::jsonb)
    ),
    coalesce(v_packet.exact_action,'{}'::jsonb),
    jsonb_build_object('packet_id',p_packet_id,'capability_id',v_packet.capability_id),
    jsonb_build_object(
      'approval_requested',true,
      'packet_id',p_packet_id,
      'authority_chain',coalesce(v_packet.authority_policy->'authority_chain','[]'::jsonb),
      'spend_limit_nzd',coalesce((v_packet.budget_policy->>'max_cost_nzd')::numeric,0)
    )
  ) into v_recheck;

  if coalesce(v_recheck->>'verdict','deny') = 'deny' then
    raise exception 'PDP_DENIED_AFTER_APPROVAL_REVIEW:%',v_recheck;
  end if;

  select public.economic_request_sha256(p_packet_id) into v_hash;
  v_token:=encode(extensions.gen_random_bytes(32),'hex');
  v_exp:=now()+make_interval(secs=>p_ttl_seconds);

  insert into public.economic_action_authorizations(
    packet_id,request_sha256,credential_sha256,approver_id,decision,expires_at,metadata
  )
  values(
    p_packet_id,v_hash,encode(extensions.digest(v_token,'sha256'),'hex'),
    p_approver_id,p_decision,v_exp,
    jsonb_build_object(
      'policy','EXACT_PACKET_SINGLE_USE',
      'out_of_band_required',true,
      'pdp_decision_id',v_recheck->>'decision_id',
      'pdp_trace_id',v_recheck->>'trace_id',
      'pdp_verdict_at_approval',v_recheck->>'verdict'
    )
  )
  returning authorization_id into v_id;

  insert into public.economic_human_interventions(
    action_id,intervention_type,reason,actor,reversible,evidence_reference,metadata
  )
  values(
    v_packet.action_id,
    'ECONOMIC_PACKET_APPROVAL',
    case when p_decision='APPROVE' then 'Human approval recorded; PDP re-evaluated.' else 'Human denial recorded.' end,
    p_approver_id,
    true,
    v_hash,
    jsonb_build_object(
      'packet_id',p_packet_id,
      'decision',p_decision,
      'pdp_decision_id',v_recheck->>'decision_id',
      'pdp_trace_id',v_recheck->>'trace_id'
    )
  );

  return jsonb_build_object(
    'authorization_id',v_id,
    'packet_id',p_packet_id,
    'request_sha256',v_hash,
    'decision',p_decision,
    'expires_at',v_exp,
    'credential',v_token,
    'pdp_recheck',v_recheck
  );
end
$function$;

revoke all on function public.economic_issue_action_authorization(uuid,text,text,integer) from public, anon, authenticated;
grant execute on function public.economic_issue_action_authorization(uuid,text,text,integer) to service_role;

-- Make the seven hardened tables explicitly reject anon/authenticated access.
do $$
declare
  t text;
  op text;
begin
  foreach t in array array[
    'pre_registrations',
    'evidence_graph_edges',
    'gauntlet_certificates',
    'gauntlet_policy_registry',
    'silo_factory_batches',
    'company_autopilot_state',
    'company_autopilot_runs'
  ]
  loop
    execute format('alter table public.%I enable row level security',t);
    execute format('alter table public.%I force row level security',t);
    execute format('revoke all on table public.%I from anon, authenticated',t);
    foreach op in array array['select','insert','update','delete']
    loop
      execute format('drop policy if exists "reject_%s_%s" on public.%I',op,t,t);
      if op='select' then
        execute format('create policy "reject_%s_%s" on public.%I for select to anon, authenticated using (false)',op,t,t);
      elsif op='insert' then
        execute format('create policy "reject_%s_%s" on public.%I for insert to anon, authenticated with check (false)',op,t,t);
      elsif op='update' then
        execute format('create policy "reject_%s_%s" on public.%I for update to anon, authenticated using (false) with check (false)',op,t,t);
      else
        execute format('create policy "reject_%s_%s" on public.%I for delete to anon, authenticated using (false)',op,t,t);
      end if;
    end loop;
  end loop;
end $$;

-- Pin the Batch 14 exclusion function with a non-hijackable path.
alter function public.check_source_exclusion(text,text,jsonb)
  set search_path = public, pg_temp;

-- Evidence completeness: a VERIFIED economic outcome must carry all thirteen
-- evidence claims. This is deliberately a database boundary, not a UI rule.
create or replace function public.economic_outcome_evidence_complete(p_metadata jsonb)
returns boolean
language sql
immutable
security definer
set search_path = public, pg_temp
as $function$
  select coalesce(
    bool_and(coalesce((p_metadata->'evidence_claims'->>k)::boolean,false)),
    false
  )
  from unnest(array[
    'artifact_integrity',
    'temporal_existence',
    'provenance',
    'approval_evidence',
    'declared_ordering',
    'capture_claim',
    'relevance_claim',
    'deliberation_traceability',
    'monitoring_claim',
    'anchoring_authorization_claim',
    'policy_assessment_claim',
    'risk_treatment_claim',
    'mitigation_implementation_claim'
  ]) k;
$function$;

revoke all on function public.economic_outcome_evidence_complete(jsonb) from public, anon, authenticated;
grant execute on function public.economic_outcome_evidence_complete(jsonb) to service_role;

create or replace function public.enforce_economic_outcome_evidence_completeness()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if upper(coalesce(new.truth_status,''))='VERIFIED'
     and not public.economic_outcome_evidence_complete(coalesce(new.metadata,'{}'::jsonb))
  then
    raise exception 'VERIFIED outcome blocked: thirteen evidence claims are incomplete';
  end if;
  return new;
end;
$function$;

drop trigger if exists economic_outcome_evidence_completeness on public.economic_outcomes;
create trigger economic_outcome_evidence_completeness
before insert or update of truth_status, metadata
on public.economic_outcomes
for each row execute function public.enforce_economic_outcome_evidence_completeness();

-- Database-level non-bypassability: a packet may become AUTHORIZED only if the
-- referenced PDP decision exists and was an allow decision for the same request.
create or replace function public.enforce_economic_packet_authorization()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  d public.economic_authorization_decisions%rowtype;
  expected_hash text;
begin
  if new.status='AUTHORIZED' then
    if new.authorization_decision_id is null then
      raise exception 'AUTHORIZED packet blocked: PDP decision required';
    end if;

    select * into d
    from public.economic_authorization_decisions
    where decision_id=new.authorization_decision_id;

    if not found or d.verdict<>'allow' then
      raise exception 'AUTHORIZED packet blocked: PDP decision is not allow';
    end if;

    expected_hash := encode(
      extensions.digest(
        convert_to(
          jsonb_build_object(
            'subject',d.subject,
            'action',d.action,
            'resource',d.resource,
            'context',d.context,
            'verdict',d.verdict,
            'policy_version',d.policy_version
          )::text,
          'utf8'
        ),
        'sha256'
      ),
      'hex'
    );

    if expected_hash <> d.request_hash then
      raise exception 'AUTHORIZED packet blocked: PDP request hash mismatch';
    end if;

    if new.authorization_trace_id is distinct from d.trace_id
       or new.authorization_request_hash is distinct from d.request_hash
    then
      raise exception 'AUTHORIZED packet blocked: PDP trace/hash mismatch';
    end if;

    if coalesce(new.authority_policy->>'authorized','false') <> 'true' then
      raise exception 'AUTHORIZED packet blocked: authority policy is not authorized';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists economic_packet_authorization_guard on public.economic_execution_packets;
create trigger economic_packet_authorization_guard
before insert or update of status, authorization_decision_id, authorization_trace_id,
  authorization_request_hash, authority_policy
on public.economic_execution_packets
for each row execute function public.enforce_economic_packet_authorization();

-- A small machine-readable conformance report for CI and operations.
create or replace function public.economic_governance_conformance()
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $function$
  select jsonb_build_object(
    'schema','BROWN-EYE-GOVERNANCE-1.0',
    'authzen_sarc',true,
    'hard_deny_precedence',true,
    'human_approval_re_evaluates_pdp',true,
    'authorized_packet_requires_pdp_decision',true,
    'evidence_completeness_claims',13,
    'rls_rejection_policies',7,
    'security_definer_functions_with_search_path',
      (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
       where n.nspname='public' and p.prosecdef
         and exists(select 1 from unnest(coalesce(p.proconfig,'{}'::text[])) x where x like 'search_path=%')),
    'security_definer_functions_missing_search_path',
      (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
       where n.nspname='public' and p.prosecdef
         and not exists(select 1 from unnest(coalesce(p.proconfig,'{}'::text[])) x where x like 'search_path=%'))
  );
$function$;

revoke all on function public.economic_governance_conformance() from public, anon, authenticated;
grant execute on function public.economic_governance_conformance() to service_role;
