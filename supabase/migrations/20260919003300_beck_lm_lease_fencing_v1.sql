create or replace function public.beck_record_lm_output(p_job_id uuid,p_worker_id text,p_lease_token uuid,p_raw text,p_structured jsonb default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.jobs; v_raw uuid; v_struct uuid; v_action text;
begin
 select * into j from public.jobs where id=p_job_id and status='leased' and worker_id=p_worker_id and lease_token=p_lease_token and leased_until>pg_catalog.now();
 if not found then return pg_catalog.jsonb_build_object('status','STALE_LEASE_REJECTED'); end if;
 insert into public.cube_evidence_vault(silo_id,source,observation,verification_status,source_ref,content_hash)
 values(coalesce((select payload->>'silo_id' from public.jobs where id=j.beck_objective_id),'BECK'),'beck.lm.raw',pg_catalog.jsonb_build_object('job_id',p_job_id,'raw_output',p_raw),'UNVERIFIED','job:'||p_job_id::text,encode(extensions.digest(convert_to(p_raw,'utf8'),'sha256'),'hex')) returning evidence_id into v_raw;
 if p_structured is null then
  update public.jobs set beck_raw_lm_output=p_raw,status=case when coalesce(attempt_count,0)>=10 then 'failed' else 'pending' end,last_error='INVALID_LM_JSON' where id=p_job_id and status='leased' and worker_id=p_worker_id and lease_token=p_lease_token;
  return pg_catalog.jsonb_build_object('status','INVALID_JSON','raw_evidence_id',v_raw);
 end if;
 v_action:=p_structured->>'action_id';
 if jsonb_typeof(p_structured)<>'object' or v_action is null or jsonb_typeof(p_structured->'action_id')<>'string' then
  update public.jobs set beck_raw_lm_output=p_raw,status=case when coalesce(attempt_count,0)>=10 then 'failed' else 'pending' end,last_error='INVALID_LM_SCHEMA' where id=p_job_id and status='leased' and worker_id=p_worker_id and lease_token=p_lease_token;
  return pg_catalog.jsonb_build_object('status','INVALID_SCHEMA','raw_evidence_id',v_raw);
 end if;
 if not (v_action in ('LOOP_001_OBSERVE','LOOP_002_NORMALIZE','LOOP_003_DEMAND_SCAN','LOOP_004_SYNTHESIZE')) then
  update public.jobs set beck_raw_lm_output=p_raw,status=case when coalesce(attempt_count,0)>=10 then 'failed' else 'pending' end,last_error='INVALID_ACTION_ID' where id=p_job_id and status='leased' and worker_id=p_worker_id and lease_token=p_lease_token;
  return pg_catalog.jsonb_build_object('status','INVALID_ACTION_ID','raw_evidence_id',v_raw);
 end if;
 insert into public.cube_evidence_vault(silo_id,source,observation,verification_status,source_ref,content_hash)
 values(coalesce((select payload->>'silo_id' from public.jobs where id=j.beck_objective_id),'BECK'),'beck.lm.structured',p_structured,'UNVERIFIED','job:'||p_job_id::text,encode(extensions.digest(convert_to(p_structured::text,'utf8'),'sha256'),'hex')) returning evidence_id into v_struct;
 update public.jobs set beck_raw_lm_output=p_raw,beck_structured_lm_output=p_structured,beck_action_id=v_action where id=p_job_id and status='leased' and worker_id=p_worker_id and lease_token=p_lease_token;
 return pg_catalog.jsonb_build_object('status','UNVERIFIED_VALID','raw_evidence_id',v_raw,'structured_evidence_id',v_struct,'action_id',v_action);
end $$;