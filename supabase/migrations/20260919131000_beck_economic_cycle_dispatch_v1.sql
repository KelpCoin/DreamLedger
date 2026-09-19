-- BECK economic cycle dispatch v1
-- Extends the existing LM evidence/verification path. No new queue.

create or replace function public.beck_record_lm_output(
  p_job_id uuid,
  p_worker_id text,
  p_lease_token uuid,
  p_raw text,
  p_structured jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  j public.jobs;
  v_raw uuid;
  v_struct uuid;
  v_action text;
begin
  select * into j
  from public.jobs
  where id=p_job_id
    and status='leased'
    and worker_id=p_worker_id
    and lease_token=p_lease_token
    and leased_until>pg_catalog.now();

  if not found then
    return jsonb_build_object('status','STALE_LEASE_REJECTED');
  end if;

  insert into public.cube_evidence_vault(
    silo_id,source,observation,verification_status,source_ref,content_hash
  )
  values(
    coalesce((select payload->>'silo_id' from public.jobs where id=j.beck_objective_id),'BECK'),
    'beck.lm.raw',
    jsonb_build_object('job_id',p_job_id,'raw_output',p_raw),
    'UNVERIFIED',
    'job:'||p_job_id::text,
    encode(extensions.digest(convert_to(p_raw,'utf8'),'sha256'),'hex')
  )
  returning evidence_id into v_raw;

  if p_structured is null then
    update public.jobs
    set beck_raw_lm_output=p_raw,
        status=case when coalesce(attempt_count,0)>=10 then 'failed' else 'pending' end,
        last_error='INVALID_LM_JSON'
    where id=p_job_id and status='leased' and worker_id=p_worker_id and lease_token=p_lease_token;
    return jsonb_build_object('status','INVALID_JSON','raw_evidence_id',v_raw);
  end if;

  v_action:=p_structured->>'action_id';

  if jsonb_typeof(p_structured)<>'object'
     or v_action is null
     or jsonb_typeof(p_structured->'action_id')<>'string' then
    update public.jobs
    set beck_raw_lm_output=p_raw,
        status=case when coalesce(attempt_count,0)>=10 then 'failed' else 'pending' end,
        last_error='INVALID_LM_SCHEMA'
    where id=p_job_id and status='leased' and worker_id=p_worker_id and lease_token=p_lease_token;
    return jsonb_build_object('status','INVALID_SCHEMA','raw_evidence_id',v_raw);
  end if;

  if not (
    v_action in (
      'INSPECT_COMMERCIAL_PATH','ANALYZE_ECONOMICS','VERIFY_CHECKOUT',
      'DISCOVER_DEMAND','PREPARE_DISTRIBUTION','PREPARE_OUTREACH',
      'VERIFY_PAYMENT','RECONCILE_REVENUE','FULFIL_ORDER','LEARN_FROM_OUTCOME',
      'LOOP_001_OBSERVE','LOOP_002_NORMALIZE','LOOP_003_DEMAND_SCAN','LOOP_004_SYNTHESIZE'
    )
  ) then
    update public.jobs
    set beck_raw_lm_output=p_raw,
        status=case when coalesce(attempt_count,0)>=10 then 'failed' else 'pending' end,
        last_error='INVALID_ACTION_ID'
    where id=p_job_id and status='leased' and worker_id=p_worker_id and lease_token=p_lease_token;
    return jsonb_build_object('status','INVALID_ACTION_ID','raw_evidence_id',v_raw);
  end if;

  insert into public.cube_evidence_vault(
    silo_id,source,observation,verification_status,source_ref,content_hash
  )
  values(
    coalesce((select payload->>'silo_id' from public.jobs where id=j.beck_objective_id),'BECK'),
    'beck.lm.structured',
    p_structured,
    'UNVERIFIED',
    'job:'||p_job_id::text,
    encode(extensions.digest(convert_to(p_structured::text,'utf8'),'sha256'),'hex')
  )
  returning evidence_id into v_struct;

  update public.jobs
  set beck_raw_lm_output=p_raw,
      beck_structured_lm_output=p_structured,
      beck_action_id=v_action
  where id=p_job_id
    and status='leased'
    and worker_id=p_worker_id
    and lease_token=p_lease_token;

  return jsonb_build_object(
    'status','UNVERIFIED_VALID',
    'raw_evidence_id',v_raw,
    'structured_evidence_id',v_struct,
    'action_id',v_action
  );
end $$;

create or replace function public.beck_verify_loop_evidence(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  j public.jobs;
  o public.jobs;
  v_id uuid;
  v_next uuid;
begin
  select * into j from public.jobs where id=p_job_id;
  if not found then return jsonb_build_object('status','NOT_FOUND'); end if;

  if j.beck_action_id is null then return jsonb_build_object('status','NO_ACTION'); end if;

  select * into o
  from public.jobs
  where id=j.beck_objective_id and type='beck_objective';

  if not found or o.beck_lifecycle <> 'active' then
    return jsonb_build_object('status','OBJECTIVE_NOT_ACTIVE');
  end if;

  if j.beck_action_id='LOOP_002_NORMALIZE'
     and not exists(
       select 1 from public.cube_evidence_vault e
       where e.silo_id=coalesce(o.payload->>'silo_id','BECK')
         and e.source='beck.loop.001'
         and e.verification_status='VERIFIED'
         and e.created_at>pg_catalog.now()-interval '24 hours'
     ) then
    return jsonb_build_object('status','DEPENDENCY_MISSING','dependency','LOOP_001');
  end if;

  if j.beck_action_id='LOOP_004_SYNTHESIZE'
     and not exists(
       select 1 from public.cube_evidence_vault e
       where e.silo_id=coalesce(o.payload->>'silo_id','BECK')
         and e.source in ('beck.loop.001','beck.loop.002','beck.loop.003')
         and e.created_at>pg_catalog.now()-interval '24 hours'
     ) then
    return jsonb_build_object('status','DEPENDENCY_MISSING','dependency','LOOP_001_002_003');
  end if;

  if j.beck_evidence_ids is null or array_length(j.beck_evidence_ids,1) is null then
    return jsonb_build_object('status','NO_EVIDENCE');
  end if;

  foreach v_id in array j.beck_evidence_ids loop
    update public.cube_evidence_vault
    set verification_status='VERIFIED',
        decision=jsonb_build_object(
          'verifier','beck_verify_loop_evidence',
          'job_id',j.id,
          'action_id',j.beck_action_id
        )
    where evidence_id=v_id and verification_status='UNVERIFIED';
  end loop;

  update public.jobs
  set status='completed',
      completed_at=pg_catalog.now(),
      leased_until=null,
      worker_id=null,
      lease_token=null,
      result_payload=jsonb_build_object(
        'verified',true,
        'action_id',j.beck_action_id
      )
  where id=j.id
    and status='leased'
    and worker_id=j.worker_id
    and lease_token=j.lease_token;

  if not found then
    return jsonb_build_object('status','STALE_LEASE_REJECTED','job_id',j.id);
  end if;

  if not exists(
    select 1 from public.jobs
    where id=o.id
      and beck_lifecycle='active'
      and beck_terminal_result is not null
  ) then
    insert into public.jobs(
      type,status,payload,beck_lifecycle,beck_objective_id,
      beck_success_condition_hash,parent_job_id,recursion_depth
    )
    values(
      'beck_loop_001','pending',
      jsonb_build_object(
        'silo_id',coalesce(o.payload->>'silo_id','BECK'),
        'cycle_parent',j.id,
        'economic_objective',true
      ),
      null,
      o.id,
      o.beck_success_condition_hash,
      j.id,
      coalesce(j.recursion_depth,0)+1
    )
    returning id into v_next;
  end if;

  return jsonb_build_object(
    'status','VERIFIED',
    'job_id',j.id,
    'action_id',j.beck_action_id,
    'next_job_id',v_next
  );
end $$;

revoke all on function public.beck_record_lm_output(uuid,text,uuid,text,jsonb) from public;
revoke all on function public.beck_verify_loop_evidence(uuid) from public;
grant execute on function public.beck_record_lm_output(uuid,text,uuid,text,jsonb) to service_role;
grant execute on function public.beck_verify_loop_evidence(uuid) to service_role;
