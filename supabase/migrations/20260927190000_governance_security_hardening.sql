-- Batch 14 governance hardening.
-- Fail closed for excluded economic sources and exposed security-sensitive tables.
-- Not applied to production by this commit.

create table if not exists public.economic_exclusions (
  exclusion_id uuid primary key default gen_random_uuid(),
  source_pattern text,
  category_pattern text,
  metadata_source_pattern text,
  reason text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (source_pattern is not null or category_pattern is not null or metadata_source_pattern is not null)
);

create index if not exists economic_exclusions_active_idx
  on public.economic_exclusions(active, exclusion_id);

alter table public.economic_exclusions enable row level security;

revoke all on public.economic_exclusions from anon, authenticated;
grant select, insert, update, delete on public.economic_exclusions to service_role;

drop policy if exists "service_role economic exclusions" on public.economic_exclusions;
create policy "service_role economic exclusions"
  on public.economic_exclusions
  for all to service_role
  using (true)
  with check (true);

insert into public.economic_exclusions
  (source_pattern, reason)
select '%n8n%', 'OPERATOR_EXCLUDED_SOURCE:n8n'
where not exists (
  select 1 from public.economic_exclusions
  where active
    and source_pattern = '%n8n%'
    and reason = 'OPERATOR_EXCLUDED_SOURCE:n8n'
);

create or replace function public.check_source_exclusion(
  p_source text,
  p_category text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns table(excluded boolean, reason text, exclusion_id uuid)
language sql
security definer
set search_path = public
as $$
  select
    true,
    e.reason,
    e.exclusion_id
  from public.economic_exclusions e
  where e.active
    and (
      (e.source_pattern is not null and coalesce(p_source,'') ilike e.source_pattern)
      or (e.category_pattern is not null and coalesce(p_category,'') ilike e.category_pattern)
      or (e.metadata_source_pattern is not null
          and coalesce(p_metadata->>'source','') ilike e.metadata_source_pattern)
    )
  order by e.created_at desc
  limit 1;

  -- Empty result means no exclusion.
$$;

revoke all on function public.check_source_exclusion(text,text,jsonb) from public, anon, authenticated;
grant execute on function public.check_source_exclusion(text,text,jsonb) to service_role;

-- Fail closed at packet creation. Internal planning can still be represented,
-- but excluded source/category packets are never GREEN/AUTHORIZED.
create or replace function public.create_economic_execution_packet(
  p_opportunity_id uuid,
  p_objective text,
  p_exact_action jsonb,
  p_predicted_postcondition jsonb,
  p_verification_predicate jsonb,
  p_capability_id text,
  p_budget_policy jsonb,
  p_kill_conditions jsonb,
  p_evidence_plan jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_packet uuid;
  v_lane jsonb;
  v_action uuid;
  v_cost numeric;
  v_status text;
  v_approval boolean;
  v_action_type text;
  v_target text;
  v_idempotency_key text;
  v_source text;
  v_category text;
  v_exclusion record;
begin
  v_cost:=coalesce((p_budget_policy->>'max_cost_nzd')::numeric,0);
  v_action_type:=coalesce(p_exact_action->>'action_type','BUILD_EXECUTION_PACKET');
  v_source:=coalesce(
    nullif(p_exact_action->>'source',''),
    nullif(p_exact_action->>'source_ref',''),
    nullif(p_exact_action->>'channel','')
  );
  v_category:=coalesce(p_exact_action->>'category','planning');

  select * into v_exclusion
  from public.check_source_exclusion(v_source,v_category,p_exact_action)
  limit 1;

  if coalesce(v_exclusion.excluded,false) then
    v_lane:=jsonb_build_object(
      'authorized',false,
      'lane','RED',
      'reason','SOURCE_EXCLUDED',
      'exclusion_reason',v_exclusion.reason,
      'exclusion_id',v_exclusion.exclusion_id,
      'policy_version','exclusion-gate-v1',
      'human_approval_required',true
    );
  else
    v_lane:=public.authorize_economic_action(
      v_action_type,
      v_cost,
      v_category,
      coalesce((p_exact_action->>'reversible')::boolean,true)
    );
  end if;

  if coalesce((v_lane->>'lane'),'RED')='RED' then
    -- Preserve a durable BLOCKED packet rather than silently authorizing or
    -- dropping the planning request. This makes the exclusion observable.
    v_approval:=true;
    v_status:='BLOCKED';
  else
    v_approval:=coalesce((v_lane->>'human_approval_required')::boolean,false);
    v_status:=case
      when (v_lane->>'lane')='GREEN' and coalesce((v_lane->>'authorized')::boolean,false)
        then 'AUTHORIZED'
      when (v_lane->>'lane')='AMBER'
        then 'STAGED'
      else 'BLOCKED'
    end;
  end if;

  v_target:=nullif(btrim(coalesce(p_exact_action->>'target',p_capability_id,'')),'');
  if v_target is null then
    raise exception 'execution packet blocked: concrete target required';
  end if;

  v_idempotency_key:='EEP:'||v_action_type||':'||p_opportunity_id::text;
  if nullif(btrim(v_idempotency_key),'') is null then
    raise exception 'execution packet blocked: stable idempotency key required';
  end if;

  insert into public.economic_actions(
    candidate_id,offer_id,action_type,approval_required,metadata,
    target,payload,authorization_state,idempotency_key,execution_state,
    intent_key,actor
  )
  values(
    null,null,
    case when v_action_type='SEND_OUTREACH' then 'OUTREACH_PREPARED' else v_action_type end,
    v_approval,
    jsonb_build_object(
      'opportunity_id',p_opportunity_id,
      'authority',v_lane,
      'packet_status',v_status,
      'requested_action_type',v_action_type,
      'target',v_target,
      'idempotency_key',v_idempotency_key,
      'exclusion_gate',case when v_exclusion.excluded then 'BLOCKED' else 'CLEAR' end
    ),
    v_target,
    p_exact_action,
    case when coalesce((v_lane->>'authorized')::boolean,false) then 'AUTHORIZED' else 'AUTHORITY_REQUIRED' end,
    v_idempotency_key,
    case when coalesce((v_lane->>'authorized')::boolean,false) then 'AUTHORIZED' else 'PREPARED' end,
    v_idempotency_key,
    'economic_operating_tick'
  )
  on conflict (idempotency_key) where idempotency_key is not null do update set
    target=excluded.target,
    payload=excluded.payload,
    metadata=excluded.metadata,
    authorization_state=excluded.authorization_state,
    execution_state=excluded.execution_state,
    approval_required=excluded.approval_required
  returning action_id into v_action;

  insert into public.economic_execution_packets(
    opportunity_id,action_id,capability_id,objective,exact_action,
    predicted_postcondition,verification_predicate,authority_policy,
    budget_policy,kill_conditions,evidence_plan,status
  )
  values(
    p_opportunity_id,v_action,p_capability_id,p_objective,p_exact_action,
    p_predicted_postcondition,p_verification_predicate,v_lane,
    p_budget_policy,p_kill_conditions,p_evidence_plan,v_status
  )
  on conflict(opportunity_id,packet_version) do update set
    job_id=null,updated_at=now(),action_id=excluded.action_id,capability_id=excluded.capability_id,
    objective=excluded.objective,exact_action=excluded.exact_action,
    predicted_postcondition=excluded.predicted_postcondition,verification_predicate=excluded.verification_predicate,
    authority_policy=excluded.authority_policy,budget_policy=excluded.budget_policy,
    kill_conditions=excluded.kill_conditions,evidence_plan=excluded.evidence_plan,status=excluded.status
  returning packet_id into v_packet;

  update public.cube_opportunities
  set execution_packet_id=v_packet,authority_lane=v_lane->>'lane',last_evaluated_at=now(),updated_at=now()
  where opportunity_id=p_opportunity_id;

  return v_packet;
end;
$function$;

-- Dispatch is a second independent safety boundary. A stale or manually-mutated
-- packet cannot bypass the exclusion gate.
create or replace function public.dispatch_authorized_economic_packets(p_limit integer default 4)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  p record;
  j uuid;
  n integer := 0;
  external_pending integer := 0;
  approval_pending integer := 0;
  internal_pending integer := 0;
  actuator_unavailable integer := 0;
  exclusion record;
  external_actuator_ready boolean := exists(
    select 1 from public.economic_actuators
    where actuator_id='generic_external_action'
      and status='AVAILABLE'
      and last_observed_at is not null
      and last_observed_at > now() - interval '2 minutes'
  );
begin
  if p_limit < 1 or p_limit > 50 then raise exception 'limit must be 1..50'; end if;

  for p in
    select * from public.economic_execution_packets
    where status in ('AUTHORIZED','STAGED') and job_id is null
    order by created_at
    limit p_limit
  loop
    select * into exclusion
    from public.check_source_exclusion(
      coalesce(p.exact_action->>'source',p.exact_action->>'source_ref',p.exact_action->>'channel'),
      coalesce(p.exact_action->>'category','planning'),
      p.exact_action
    )
    limit 1;

    if coalesce(exclusion.excluded,false) then
      update public.economic_execution_packets
      set status='BLOCKED',
          authority_policy=jsonb_build_object(
            'authorized',false,
            'lane','RED',
            'reason','SOURCE_EXCLUDED',
            'exclusion_reason',exclusion.reason,
            'exclusion_id',exclusion.exclusion_id,
            'policy_version','exclusion-gate-v1',
            'human_approval_required',true
          ),
          exact_action=p.exact_action || jsonb_build_object(
            'external_action_allowed',false,
            'requires_human_approval',true,
            'blocked_reason','SOURCE_EXCLUDED'
          ),
          updated_at=now()
      where packet_id=p.packet_id;
      continue;
    end if;

    if coalesce((p.exact_action->>'external_action_allowed')::boolean,false)
       and coalesce((p.authority_policy->>'lane'),'RED')='AMBER'
       and coalesce((p.authority_policy->>'human_approval_required')::boolean,true)
    then
      approval_pending := approval_pending + 1;
      continue;
    end if;

    if coalesce((p.exact_action->>'external_action_allowed')::boolean,false)
       and coalesce((p.authority_policy->>'authorized')::boolean,false)
       and coalesce((p.authority_policy->>'lane'),'RED')='GREEN'
    then
      if not external_actuator_ready then
        actuator_unavailable := actuator_unavailable + 1;
        continue;
      end if;

      insert into public.jobs(
        type,payload,status,attempt_count,objective_text,success_condition,
        failure_condition,authority_policy,budget_policy,current_state,next_action
      )
      values(
        'EXTERNAL_ACTION',
        jsonb_build_object(
          'economic_packet_id',p.packet_id,'opportunity_id',p.opportunity_id,
          'capability_id',p.capability_id,'exact_action',p.exact_action,
          'predicted_postcondition',p.predicted_postcondition,
          'verification_predicate',p.verification_predicate,
          'kill_conditions',p.kill_conditions,'external_action_allowed',true
        ),
        'pending',0,p.objective,
        jsonb_build_object('observable_external_result_required',true,'external_action_required',true),
        jsonb_build_object('capability_unverified',true,'scope_expanded',true,'counterparty_unknown',true),
        p.authority_policy,p.budget_policy,'pending',
        jsonb_build_object('packet_id',p.packet_id,'action_type',coalesce(p.exact_action->>'action_type','EXTERNAL_ACTION'),'lane','GREEN')
      )
      returning id into j;

      update public.economic_execution_packets set job_id=j,status='DISPATCHED',updated_at=now() where packet_id=p.packet_id;
      insert into public.economic_job_events(job_id,opportunity_id,to_state,event_type,actor,evidence)
      values(j,p.opportunity_id,'DISPATCHED','EXTERNAL_ACTION_JOB_CREATED','economic-operating-loop',
        jsonb_build_object('packet_id',p.packet_id,'external_action_allowed',true,'authority_lane','GREEN','actuator_id','generic_external_action'));
      n := n + 1;
      external_pending := external_pending + 1;
    else
      insert into public.jobs(
        type,payload,status,attempt_count,objective_text,success_condition,
        failure_condition,authority_policy,budget_policy,current_state,next_action
      )
      values(
        'CUBE_REFINERY_RESEARCH',
        jsonb_build_object(
          'economic_packet_id',p.packet_id,'opportunity_id',p.opportunity_id,'capability_id',p.capability_id,
          'exact_action',p.exact_action,'predicted_postcondition',p.predicted_postcondition,
          'verification_predicate',p.verification_predicate,'kill_conditions',p.kill_conditions,
          'external_action_allowed',false,'reason','PACKET_NOT_AUTHORIZED_FOR_EXTERNAL_ACTION'
        ),
        'pending',0,p.objective,
        jsonb_build_object('observable_result_required',true,'external_spend',false,'external_contact',false),
        jsonb_build_object('capability_unverified',true,'scope_expanded',true,'counterparty_unknown',true),
        p.authority_policy,p.budget_policy,'pending',
        jsonb_build_object('packet_id',p.packet_id,'action_type','RESEARCH','external_action_allowed',false)
      )
      returning id into j;

      update public.economic_execution_packets set job_id=j,status='DISPATCHED',updated_at=now() where packet_id=p.packet_id;
      insert into public.economic_job_events(job_id,opportunity_id,to_state,event_type,actor,evidence)
      values(j,p.opportunity_id,'DISPATCHED','RESEARCH_JOB_CREATED','economic-operating-loop',
        jsonb_build_object('packet_id',p.packet_id,'external_action_allowed',false,'reason','PACKET_NOT_AUTHORIZED_FOR_EXTERNAL_ACTION'));
      n := n + 1;
      internal_pending := internal_pending + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'dispatched',n,'external_action_jobs',external_pending,'approval_pending',approval_pending,
    'internal_research_jobs',internal_pending,'external_actuator_ready',external_actuator_ready,
    'external_actuator_unavailable',actuator_unavailable
  );
end;
$function$;

-- Seven currently exposed security-sensitive tables are fail-closed until
-- purpose-specific policies are designed and tested. Existing server-side
-- service-role/SQL workers remain functional; anon/authenticated lose direct
-- table access.
do $$
declare
  t text;
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
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;

-- Explicit service-role policies document the intended server-side path.
-- service_role normally bypasses RLS, but these policies make the contract
-- explicit and survive future role changes.
do $$
declare
  t text;
  policy_name text;
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
    policy_name := 'service_role_only_' || t;
    execute format('drop policy if exists %I on public.%I', policy_name, t);
    execute format(
      'create policy %I on public.%I for all to service_role using (true) with check (true)',
      policy_name, t
    );
  end loop;
end $$;

-- The commerce bridge view must be security-invoker when this migration
-- reaches the database. The view is created by the commerce bridge migration.
do $$
begin
  if exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='commerce_order_operations' and c.relkind='v'
  ) then
    execute 'alter view public.commerce_order_operations set (security_invoker = on)';
  end if;
end $$;

comment on table public.economic_exclusions is
'Canonical fail-closed economic source/category exclusions. Authorization and dispatch paths must consult this table.';
