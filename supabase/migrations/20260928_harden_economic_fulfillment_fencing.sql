-- Harden economic fulfillment finalization with the claimed lease token.
create or replace function public.complete_economic_fulfillment_job(
  p_job_id uuid,p_worker_id text,p_lease_token uuid,p_storage_path text,p_sha256 text,p_byte_size bigint,p_result jsonb
) returns public.jobs language plpgsql security definer set search_path to 'public' as $function$
declare v_job public.jobs%rowtype;
begin
  select * into v_job from public.jobs
  where id=p_job_id and status='running' and worker_id=p_worker_id
    and lease_token=p_lease_token and leased_until>now() for update;
  if not found then raise exception 'ECONOMIC_FULFILLMENT_LEASE_INVALID'; end if;
  if p_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'ECONOMIC_FULFILLMENT_BAD_SHA256'; end if;
  update public.jobs set status='completed',completed_at=now() at time zone 'UTC',
    leased_until=null,
    result_payload=coalesce(p_result,'{}'::jsonb)||jsonb_build_object(
      'artifact_storage_path',p_storage_path,'artifact_sha256',lower(p_sha256),
      'artifact_byte_size',p_byte_size,'fulfillment_state','COMPLETED'),
    current_state='FULFILLED_UNPAID',last_progress_at=now(),last_evidence_at=now(),
    recursive_reconciled_at=now()
  where id=p_job_id and status='running' and worker_id=p_worker_id
    and lease_token=p_lease_token and leased_until>now()
  returning * into v_job;
  if not found then raise exception 'ECONOMIC_FULFILLMENT_STALE_EXECUTION'; end if;
  return v_job;
end;$function$;

create or replace function public.fail_economic_fulfillment_job(
  p_job_id uuid,p_worker_id text,p_lease_token uuid,p_reason text
) returns public.jobs language plpgsql security definer set search_path to 'public' as $function$
declare v_job public.jobs%rowtype;
begin
  select * into v_job from public.jobs
  where id=p_job_id and status='running' and worker_id=p_worker_id
    and lease_token=p_lease_token and leased_until>now() for update;
  if not found then raise exception 'ECONOMIC_FULFILLMENT_LEASE_INVALID'; end if;
  update public.jobs set status='failed',completed_at=now() at time zone 'UTC',
    leased_until=null,last_error=left(coalesce(p_reason,'unknown failure'),2000),
    current_state='FULFILLMENT_FAILED',last_progress_at=now()
  where id=p_job_id and status='running' and worker_id=p_worker_id
    and lease_token=p_lease_token and leased_until>now()
  returning * into v_job;
  if not found then raise exception 'ECONOMIC_FULFILLMENT_STALE_EXECUTION'; end if;
  return v_job;
end;$function$;

revoke all on function public.queue_economic_fulfillment_job(text,jsonb,text,text,text) from public,anon,authenticated;
revoke all on function public.claim_economic_fulfillment_job(text,integer) from public,anon,authenticated;
revoke all on function public.complete_economic_fulfillment_job(uuid,text,text,text,bigint,jsonb) from public,anon,authenticated;
revoke all on function public.fail_economic_fulfillment_job(uuid,text,text) from public,anon,authenticated;
revoke all on function public.complete_economic_fulfillment_job(uuid,text,uuid,text,text,bigint,jsonb) from public,anon,authenticated;
revoke all on function public.fail_economic_fulfillment_job(uuid,text,uuid,text) from public,anon,authenticated;

grant execute on function public.queue_economic_fulfillment_job(text,jsonb,text,text,text) to service_role;
grant execute on function public.claim_economic_fulfillment_job(text,integer) to service_role;
grant execute on function public.complete_economic_fulfillment_job(uuid,text,uuid,text,text,bigint,jsonb) to service_role;
grant execute on function public.fail_economic_fulfillment_job(uuid,text,uuid,text) to service_role;