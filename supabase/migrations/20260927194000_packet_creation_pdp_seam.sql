-- Batch 15: route execution-packet creation through the canonical PDP.
-- This removes the old direct authorize_economic_action() decision seam from
-- packet creation. Existing callers that attempt to forge AUTHORIZED state are
-- caught by the Batch 15 database trigger.

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
set search_path = public, pg_temp
as $function$
declare
  v_packet uuid;
  v_decision jsonb;
  v_lane jsonb;
  v_action uuid;
  v_cost numeric;
  v_status text;
  v_approval boolean;
  v_action_type text;
  v_target text;
  v_idempotency_key text;
begin
  v_cost := coalesce((p_budget_policy->>'max_cost_nzd')::numeric,0);
  v_action_type := coalesce(p_exact_action->>'action_type','BUILD_EXECUTION_PACKET');

  select public.evaluate_economic_authorization(
    jsonb_build_object(
      'principal','economic_operating_loop',
      'actor','CUBE',
      'capability_id',p_capability_id
    ),
    coalesce(p_exact_action,'{}'::jsonb) || jsonb_build_object('action_type',v_action_type),
    jsonb_build_object(
      'opportunity_id',p_opportunity_id,
      'capability_id',p_capability_id,
      'objective',p_objective
    ),
    jsonb_build_object(
      'authority_scope',coalesce(p_exact_action->'authority_scope','[]'::jsonb),
      'authority_chain',coalesce(p_exact_action->'authority_chain','[]'::jsonb),
      'spend_limit_nzd',v_cost,
      'delegation_depth',coalesce((p_exact_action->>'delegation_depth')::integer,0),
      'max_delegation_depth',coalesce((p_exact_action->>'max_delegation_depth')::integer,0)
    )
  ) into v_decision;

  v_lane := jsonb_build_object(
    'authorized',coalesce((v_decision->>'authorized')::boolean,false),
    'lane',case
      when v_decision->>'verdict'='allow' then 'GREEN'
      when v_decision->>'verdict'='needs_approval' then 'AMBER'
      else 'RED'
    end,
    'reason',coalesce(v_decision->'reasons'->0->>'code','PDP_DENY'),
    'policy_version',coalesce(v_decision->>'policy_version','unknown'),
    'human_approval_required',coalesce((v_decision->>'needs_approval')::boolean,false),
    'decision_id',v_decision->>'decision_id',
    'trace_id',v_decision->>'trace_id',
    'request_hash',v_decision->>'request_hash',
    'verdict',v_decision->>'verdict',
    'authority_chain',coalesce(v_decision->'authority_chain','[]'::jsonb)
  );

  v_approval := coalesce((v_lane->>'human_approval_required')::boolean,false);
  v_status := case
    when v_lane->>'lane'='GREEN' and coalesce((v_lane->>'authorized')::boolean,false) then 'AUTHORIZED'
    when v_lane->>'lane'='AMBER' then 'STAGED'
    else 'BLOCKED'
  end;

  v_target := nullif(btrim(coalesce(p_exact_action->>'target',p_capability_id,'')),'');
  if v_target is null then
    raise exception 'execution packet blocked: concrete target required';
  end if;

  v_idempotency_key := 'EEP:'||v_action_type||':'||p_opportunity_id::text;

  insert into public.economic_actions(
    candidate_id,offer_id,action_type,approval_required,metadata,
    target,payload,authorization_state,idempotency_key,execution_state,
    intent_key,actor
  )
  values(
    null,null,
    case when v_action_type='SEND_OUTREACH' and v_status<>'AUTHORIZED'
      then 'OUTREACH_PREPARED' else v_action_type end,
    v_approval,
    jsonb_build_object(
      'opportunity_id',p_opportunity_id,
      'authority',v_lane,
      'packet_status',v_status,
      'requested_action_type',v_action_type,
      'target',v_target,
      'idempotency_key',v_idempotency_key,
      'governance','AUTHZEN_SARC_PDP'
    ),
    v_target,p_exact_action,
    case when v_status='AUTHORIZED' then 'AUTHORIZED' else 'AUTHORITY_REQUIRED' end,
    v_idempotency_key,
    case when v_status='AUTHORIZED' then 'AUTHORIZED' else 'PREPARED' end,
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
    budget_policy,kill_conditions,evidence_plan,status,
    authorization_decision_id,authorization_trace_id,authorization_verdict,
    authorization_request_hash,authority_chain,governance_tier
  )
  values(
    p_opportunity_id,v_action,p_capability_id,p_objective,p_exact_action,
    p_predicted_postcondition,p_verification_predicate,v_lane,
    p_budget_policy,p_kill_conditions,p_evidence_plan,v_status,
    (v_decision->>'decision_id')::uuid,
    (v_decision->>'trace_id')::uuid,
    v_decision->>'verdict',
    v_decision->>'request_hash',
    coalesce(v_decision->'authority_chain','[]'::jsonb),
    case when v_lane->>'lane'='GREEN' then 3 when v_lane->>'lane'='AMBER' then 2 else 4 end
  )
  on conflict(opportunity_id,packet_version) do update set
    job_id=null,
    updated_at=now(),
    action_id=excluded.action_id,
    capability_id=excluded.capability_id,
    objective=excluded.objective,
    exact_action=excluded.exact_action,
    predicted_postcondition=excluded.predicted_postcondition,
    verification_predicate=excluded.verification_predicate,
    authority_policy=excluded.authority_policy,
    budget_policy=excluded.budget_policy,
    kill_conditions=excluded.kill_conditions,
    evidence_plan=excluded.evidence_plan,
    status=excluded.status,
    authorization_decision_id=excluded.authorization_decision_id,
    authorization_trace_id=excluded.authorization_trace_id,
    authorization_verdict=excluded.authorization_verdict,
    authorization_request_hash=excluded.authorization_request_hash,
    authority_chain=excluded.authority_chain,
    governance_tier=excluded.governance_tier
  returning packet_id into v_packet;

  update public.cube_opportunities
  set execution_packet_id=v_packet,
      authority_lane=v_lane->>'lane',
      last_evaluated_at=now(),
      updated_at=now()
  where opportunity_id=p_opportunity_id;

  return v_packet;
end;
$function$;

revoke all on function public.create_economic_execution_packet(uuid,text,jsonb,jsonb,jsonb,text,jsonb,jsonb,jsonb)
  from public, anon, authenticated;
grant execute on function public.create_economic_execution_packet(uuid,text,jsonb,jsonb,jsonb,text,jsonb,jsonb,jsonb)
  to service_role;
