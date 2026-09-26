-- Economic fulfillment worker queue RPCs.
-- Applied to project wbwgroygjeyukkspnqiy on 2026-09-26.

create or replace function public.claim_economic_fulfillment_job(p_worker_id text,p_lease_seconds integer default 1200)
returns setof public.jobs language plpgsql security definer set search_path=public as $$
declare v_job public.jobs%rowtype;
begin
 select * into v_job from public.jobs where status='queued' and type in ('economic_fulfillment','economic_fulfillment_public_research','economic_fulfillment_api_extraction','economic_fulfillment_scrape') order by created_at asc nulls first for update skip locked limit 1;
 if not found then return; end if;
 update public.jobs set status='running',worker_id=p_worker_id,started_at=coalesce(started_at,now() at time zone 'UTC'),leased_until=now()+make_interval(secs=>greatest(p_lease_seconds,60)),lease_token=gen_random_uuid(),attempt_count=coalesce(attempt_count,0)+1,current_state='FULFILLMENT_IN_PROGRESS',last_progress_at=now() where id=v_job.id returning * into v_job;
 return next v_job;
end; $$;

create or replace function public.complete_economic_fulfillment_job(p_job_id uuid,p_worker_id text,p_storage_path text,p_sha256 text,p_byte_size bigint,p_result jsonb)
returns public.jobs language plpgsql security definer set search_path=public as $$
declare v_job public.jobs%rowtype;
begin
 select * into v_job from public.jobs where id=p_job_id and status='running' and worker_id=p_worker_id and leased_until>now() for update;
 if not found then raise exception 'ECONOMIC_FULFILLMENT_LEASE_INVALID'; end if;
 if p_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'ECONOMIC_FULFILLMENT_BAD_SHA256'; end if;
 update public.jobs set status='completed',completed_at=now() at time zone 'UTC',leased_until=null,result_payload=coalesce(p_result,'{}'::jsonb)||jsonb_build_object('artifact_storage_path',p_storage_path,'artifact_sha256',lower(p_sha256),'artifact_byte_size',p_byte_size,'fulfillment_state','COMPLETED'),current_state='FULFILLED_UNPAID',last_progress_at=now(),last_evidence_at=now(),recursive_reconciled_at=now() where id=p_job_id returning * into v_job;
 return v_job;
end; $$;

create or replace function public.fail_economic_fulfillment_job(p_job_id uuid,p_worker_id text,p_reason text)
returns public.jobs language plpgsql security definer set search_path=public as $$
declare v_job public.jobs%rowtype;
begin
 select * into v_job from public.jobs where id=p_job_id and status='running' and worker_id=p_worker_id for update;
 if not found then raise exception 'ECONOMIC_FULFILLMENT_LEASE_INVALID'; end if;
 update public.jobs set status='failed',completed_at=now() at time zone 'UTC',leased_until=null,last_error=left(coalesce(p_reason,'unknown failure'),2000),current_state='FULFILLMENT_FAILED',last_progress_at=now() where id=p_job_id returning * into v_job;
 return v_job;
end; $$;

revoke all on function public.claim_economic_fulfillment_job(text,integer) from public;
revoke all on function public.complete_economic_fulfillment_job(uuid,text,text,text,bigint,jsonb) from public;
revoke all on function public.fail_economic_fulfillment_job(uuid,text,text) from public;
grant execute on function public.claim_economic_fulfillment_job(text,integer) to service_role;
grant execute on function public.complete_economic_fulfillment_job(uuid,text,text,text,bigint,jsonb) to service_role;
grant execute on function public.fail_economic_fulfillment_job(uuid,text,text) to service_role;