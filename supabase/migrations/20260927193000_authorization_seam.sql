-- Single authorization seam for economic PEPs.
-- Branch-only. Not applied to production.
--
-- Invariants:
-- 1. Exclusions deny before policy.
-- 2. Existing economic_authority_policies remain the source of policy truth.
-- 3. Human approval is an obligation, not a policy bypass.
-- 4. Approval is re-evaluated by the same PDP before packet promotion.
-- 5. SECURITY DEFINER functions are executable only by service_role.
-- 6. Internal-only tables are explicitly deny-by-policy for API roles.

-- The exclusion table is an operator-controlled invariant. Service-role may
-- read it through the locked PDP, but direct agent/API mutation is forbidden.
revoke insert, update, delete on table public.economic_exclusions from public, anon, authenticated, service_role;
revoke all on table public.economic_exclusions from public, anon, authenticated;
grant select on table public.economic_exclusions to service_role;

revoke all on function public.check_source_exclusion(text,text,jsonb) from public, anon, authenticated;
grant execute on function public.check_source_exclusion(text,text,jsonb) to service_role;
alter function public.check_source_exclusion(text,text,jsonb)
  set search_path = public, pg_temp;

-- Canonical Policy Decision Point.
create or replace function public.evaluate_economic_authorization(
  p_subject text,
  p_action text,
  p_resource text,
  p_context jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_source text;
  v_category text;
  v_cost numeric;
  v_reversible boolean;
  v_exclusion record;
  v_policy jsonb;
  v_approval jsonb;
  v_decision text;
  v_reason text;
  v_obligations jsonb;
begin
  if nullif(btrim(coalesce(p_subject,'')),'') is null
     or nullif(btrim(coalesce(p_action,'')),'') is null
     or nullif(btrim(coalesce(p_resource,'')),'') is null then
    return jsonb_build_object(
      'decision','DENY',
      'reason','MALFORMED_AUTHORIZATION_REQUEST',
      'obligations',jsonb_build_object('human_approval_required',true)
    );
  end if;

  v_source := coalesce(
    nullif(p_context->>'source',''),
    nullif(p_context->>'source_ref',''),
    nullif(p_context->>'channel','')
  );
  v_category := coalesce(p_context->>'category','general');
  v_cost := coalesce((p_context->>'max_cost_nzd')::numeric,0);
  v_reversible := coalesce((p_context->>'reversible')::boolean,true);

  select * into v_exclusion
  from public.check_source_exclusion(v_source,v_category,p_context)
  limit 1;

  if coalesce(v_exclusion.excluded,false) then
    return jsonb_build_object(
      'decision','DENY',
      'reason','SOURCE_EXCLUDED',
      'policy_version','exclusion-gate-v1',
      'exclusion_id',v_exclusion.exclusion_id,
      'exclusion_reason',v_exclusion.reason,
      'obligations',jsonb_build_object(
        'human_approval_required',true,
        'approval_can_override',false
      ),
      'subject',p_subject,
      'action',p_action,
      'resource',p_resource
    );
  end if;

  v_policy := public.authorize_economic_action(
    p_action,
    v_cost,
    v_category,
    v_reversible
  );

  if coalesce((v_policy->>'lane'),'RED') = 'RED'
     or not coalesce((v_policy->>'authorized')::boolean,false)
        and coalesce((v_policy->>'lane'),'RED') = 'RED' then
    return jsonb_build_object(
      'decision','DENY',
      'reason',coalesce(v_policy->>'reason','POLICY_DENY'),
      'policy_version',coalesce(v_policy->>'policy_version','unknown'),
      'obligations',jsonb_build_object(
        'human_approval_required',coalesce((v_policy->>'human_approval_required')::boolean,true)
      ),
      'policy',v_policy,
      'subject',p_subject,
      'action',p_action,
      'resource',p_resource
    );
  end if;

  v_approval := coalesce(p_context->'approval', '{}'::jsonb);

  if coalesce((v_policy->>'lane'),'RED') = 'GREEN'
     and coalesce((v_policy->>'authorized')::boolean,false) then
    v_decision := 'ALLOW';
    v_reason := 'POLICY_ALLOW';
    v_obligations := jsonb_build_object('human_approval_required',false);
  elsif coalesce((v_policy->>'lane'),'RED') = 'AMBER' then
    if upper(coalesce(v_approval->>'decision','')) = 'APPROVE'
       and nullif(btrim(coalesce(v_approval->>'authorization_id','')),'') is not null then
      v_decision := 'ALLOW';
      v_reason := 'HUMAN_APPROVAL_SATISFIED';
      v_obligations := jsonb_build_object(
        'human_approval_required',false,
        'approval_authorization_id',v_approval->>'authorization_id'
      );
    else
      v_decision := 'NEEDS_APPROVAL';
      v_reason := 'HUMAN_APPROVAL_REQUIRED';
      v_obligations := jsonb_build_object(
        'human_approval_required',true,
        'approval_can_override',false
      );
    end if;
  else
    v_decision := 'DENY';
    v_reason := coalesce(v_policy->>'reason','POLICY_DENY');
    v_obligations := jsonb_build_object('human_approval_required',true);
  end if;

  return jsonb_build_object(
    'decision',v_decision,
    'reason',v_reason,
    'policy_version',coalesce(v_policy->>'policy_version','unknown'),
    'obligations',v_obligations,
    'policy',v_policy,
    'subject',p_subject,
    'action',p_action,
    'resource',p_resource
  );
end;
$function$;

revoke all on function public.evaluate_economic_authorization(text,text,text,jsonb)
  from public, anon, authenticated;
grant execute on function public.evaluate_economic_authorization(text,text,text,jsonb)
  to service_role;

-- Approval consumption must consult the PDP after the human decision and before
-- any packet becomes AUTHORIZED. Exclusions therefore remain non-overridable.
create or replace function public.economic_consume_action_authorization(
  p_packet_id uuid,
  p_credential text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $function$
declare
  v record;
  p public.economic_execution_packets%rowtype;
  v_hash text;
  v_pdp jsonb;
begin
  if p_credential is null or btrim(p_credential)='' then
    return jsonb_build_object('authorized',false,'reason','MISSING_CREDENTIAL');
  end if;

  v_hash:=encode(extensions.digest(p_credential,'sha256'),'hex');

  select * into v
  from public.economic_action_authorizations
  where packet_id=p_packet_id and credential_sha256=v_hash
  for update;

  if not found then
    return jsonb_build_object('authorized',false,'reason','INVALID_CREDENTIAL');
  end if;

  if v.consumed_at is not null then
    return jsonb_build_object('authorized',false,'reason','REPLAY');
  end if;

  if now() >= v.expires_at then
    return jsonb_build_object('authorized',false,'reason','EXPIRED');
  end if;

  if v.request_sha256 <> public.economic_request_sha256(p_packet_id) then
    return jsonb_build_object('authorized',false,'reason','REQUEST_HASH_MISMATCH');
  end if;

  select * into p
  from public.economic_execution_packets
  where packet_id=p_packet_id;

  if not found then
    return jsonb_build_object('authorized',false,'reason','PACKET_NOT_FOUND');
  end if;

  select public.evaluate_economic_authorization(
    coalesce(v.approver_id,'human_approver'),
    coalesce(p.exact_action->>'action_type','SEND_OUTREACH'),
    p_packet_id::text,
    jsonb_build_object(
      'source',coalesce(p.exact_action->>'source',p.exact_action->>'source_ref',p.exact_action->>'channel'),
      'category',coalesce(p.exact_action->>'category','commercial_communication'),
      'max_cost_nzd',coalesce((p.budget_policy->>'max_cost_nzd')::numeric,0),
      'reversible',coalesce((p.exact_action->>'reversible')::boolean,true),
      'approval',jsonb_build_object(
        'decision',v.decision,
        'authorization_id',v.authorization_id,
        'approver_id',v.approver_id
      )
    )
  ) into v_pdp;

  if v.decision <> 'APPROVE' then
    return jsonb_build_object(
      'authorized',false,
      'reason','DENIED',
      'decision',v_pdp->>'decision',
      'policy_reason',v_pdp->>'reason'
    );
  end if;

  if coalesce(v_pdp->>'decision','DENY') <> 'ALLOW' then
    return jsonb_build_object(
      'authorized',false,
      'reason','PDP_DENIED_AFTER_APPROVAL',
      'decision',v_pdp->>'decision',
      'policy_reason',v_pdp->>'reason'
    );
  end if;

  update public.economic_action_authorizations
  set consumed_at=now()
  where authorization_id=v.authorization_id and consumed_at is null;

  if not found then
    return jsonb_build_object('authorized',false,'reason','REPLAY');
  end if;

  update public.economic_execution_packets
  set status='AUTHORIZED',
      job_id=null,
      exact_action=coalesce(exact_action,'{}'::jsonb)||
        jsonb_build_object(
          'external_action_allowed',true,
          'requires_human_approval',false,
          'approval_gate','HUMAN_APPROVED'
        ),
      authority_policy=coalesce(authority_policy,'{}'::jsonb)||
        jsonb_build_object(
          'authorized',true,
          'lane','GREEN',
          'human_approval_required',false,
          'authorization_id',v.authorization_id,
          'approver_id',v.approver_id,
          'authorization_consumed_at',now(),
          'reason','HUMAN_APPROVED',
          'pdp_decision','ALLOW',
          'pdp_reason',v_pdp->>'reason'
        ),
      updated_at=now()
  where packet_id=p_packet_id;

  return jsonb_build_object(
    'authorized',true,
    'reason','APPROVED',
    'authorization_id',v.authorization_id,
    'approver_id',v.approver_id,
    'pdp_decision','ALLOW'
  );
end;
$function$;

revoke all on function public.economic_consume_action_authorization(uuid,text)
  from public, anon, authenticated;
grant execute on function public.economic_consume_action_authorization(uuid,text)
  to service_role;

-- The approval issuer is also internal-only.
revoke all on function public.economic_issue_action_authorization(uuid,text,text,integer)
  from public, anon, authenticated;
grant execute on function public.economic_issue_action_authorization(uuid,text,text,integer)
  to service_role;

-- Explicit deny policies document the intended API posture of the seven
-- internal-only tables. Grants are already revoked by the preceding migration.
do $$
declare
  t text;
  select_policy text;
  insert_policy text;
  update_policy text;
  delete_policy text;
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
    select_policy := 'api_deny_select_'||t;
    insert_policy := 'api_deny_insert_'||t;
    update_policy := 'api_deny_update_'||t;
    delete_policy := 'api_deny_delete_'||t;

    execute format('drop policy if exists %I on public.%I',select_policy,t);
    execute format('drop policy if exists %I on public.%I',insert_policy,t);
    execute format('drop policy if exists %I on public.%I',update_policy,t);
    execute format('drop policy if exists %I on public.%I',delete_policy,t);

    execute format('create policy %I on public.%I for select to anon, authenticated using (false)',select_policy,t);
    execute format('create policy %I on public.%I for insert to anon, authenticated with check (false)',insert_policy,t);
    execute format('create policy %I on public.%I for update to anon, authenticated using (false) with check (false)',update_policy,t);
    execute format('create policy %I on public.%I for delete to anon, authenticated using (false)',delete_policy,t);
  end loop;
end $$;

-- Lock the existing authorization seam itself to server-side callers.
revoke all on function public.authorize_economic_action(text,numeric,text,boolean)
  from public, anon, authenticated;
grant execute on function public.authorize_economic_action(text,numeric,text,boolean)
  to service_role;
alter function public.authorize_economic_action(text,numeric,text,boolean)
  set search_path = public, pg_temp;

comment on function public.evaluate_economic_authorization(text,text,text,jsonb) is
'Canonical economic PDP. Exclusion deny takes precedence; human approval is an obligation re-evaluated by this same seam.';
