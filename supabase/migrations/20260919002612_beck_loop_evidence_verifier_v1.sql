create or replace function public.beck_verify_loop_evidence(p_job_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.jobs; o public.jobs; v_id uuid;
begin
 select * into j from public.jobs where id=p_job_id;
 if not found then return pg_catalog.jsonb_build_object('status','NOT_FOUND'); end if;
 if j.beck_action_id is null then return pg_catalog.jsonb_build_object('status','NO_ACTION'); end if;
 select * into o from public.jobs where id=j.beck_objective_id and type='beck_objective';
 if not found or o.beck_lifecycle <> 'active' then return pg_catalog.jsonb_build_object('status','OBJECTIVE_NOT_ACTIVE'); end if;
 if j.beck_action_id='LOOP_002_NORMALIZE' and not exists(select 1 from public.cube_evidence_vault e where e.silo_id=coalesce(o.payload->>'silo_id','BECK') and e.source='beck.loop.001' and e.verification_status='VERIFIED' and e.created_at>pg_catalog.now()-interval '24 hours') then return pg_catalog.jsonb_build_object('status','DEPENDENCY_MISSING','dependency','LOOP_001'); end if;
 if j.beck_action_id='LOOP_004_SYNTHESIZE' and not exists(select 1 from public.cube_evidence_vault e where e.silo_id=coalesce(o.payload->>'silo_id','BECK') and e.source in ('beck.loop.001','beck.loop.002','beck.loop.003') and e.created_at>pg_catalog.now()-interval '24 hours') then return pg_catalog.jsonb_build_object('status','DEPENDENCY_MISSING','dependency','LOOP_001_002_003'); end if;
 if j.beck_evidence_ids is null or array_length(j.beck_evidence_ids,1) is null then return pg_catalog.jsonb_build_object('status','NO_EVIDENCE'); end if;
 foreach v_id in array j.beck_evidence_ids loop
  update public.cube_evidence_vault set verification_status='VERIFIED',decision=pg_catalog.jsonb_build_object('verifier','beck_verify_loop_evidence','job_id',j.id,'action_id',j.beck_action_id) where evidence_id=v_id and verification_status='UNVERIFIED';
 end loop;
 update public.jobs set status='completed',completed_at=pg_catalog.now(),leased_until=null,worker_id=null,lease_token=null,result_payload=pg_catalog.jsonb_build_object('verified',true,'action_id',j.beck_action_id) where id=j.id and status='leased' and lease_token=j.lease_token;
 return pg_catalog.jsonb_build_object('status','VERIFIED','job_id',j.id,'action_id',j.beck_action_id);
end $$;
revoke all on function public.beck_verify_loop_evidence(uuid) from public;
grant execute on function public.beck_verify_loop_evidence(uuid) to service_role;
