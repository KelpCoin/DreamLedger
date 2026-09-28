-- ACNC automated contact fulfillment capability.
-- This adds only the existing fulfillment-worker job type; it does not queue or execute a job.
create or replace function public.queue_economic_fulfillment_job(p_type text,p_payload jsonb,p_contract_reference text,p_buyer_reference text,p_authorization_state text default 'APPROVED') returns public.jobs language plpgsql security definer set search_path to 'public' as $function$
declare v_job public.jobs%rowtype;
begin
  if p_authorization_state <> 'APPROVED' then raise exception 'ECONOMIC_FULFILLMENT_REQUIRES_APPROVED_AUTHORIZATION'; end if;
  if p_type not in ('economic_fulfillment','economic_fulfillment_public_research','economic_fulfillment_api_extraction','economic_fulfillment_scrape','economic_fulfillment_acnc_contacts') then raise exception 'ECONOMIC_FULFILLMENT_TYPE_NOT_ALLOWED'; end if;
  if coalesce(trim(p_contract_reference),'')='' then raise exception 'CONTRACT_REFERENCE_REQUIRED'; end if;
  if coalesce(trim(p_buyer_reference),'')='' then raise exception 'BUYER_REFERENCE_REQUIRED'; end if;
  insert into public.jobs(id,type,payload,status,attempt_count,recursion_depth,chain_cost,beck_lifecycle,current_state,next_action,authority_policy,economic_gate_status)
  values(gen_random_uuid(),p_type,coalesce(p_payload,'{}'::jsonb),'queued',0,0,0,'active','QUEUED_FOR_FULFILLMENT',
    jsonb_build_object('action','lease_economic_fulfillment_job'),
    jsonb_build_object('authorization_state',p_authorization_state,'contract_reference',p_contract_reference,'buyer_reference',p_buyer_reference),
    'REVENUE_PATH_CLEAR')
  returning * into v_job;
  return v_job;
end;
$function$;

create or replace function public.claim_economic_fulfillment_job(p_worker_id text,p_lease_seconds integer default 1200) returns setof public.jobs language plpgsql security definer set search_path to 'public' as $function$
declare v_job public.jobs%rowtype;
begin
  select * into v_job from public.jobs
  where status='queued'
    and type in ('economic_fulfillment','economic_fulfillment_public_research','economic_fulfillment_api_extraction','economic_fulfillment_scrape','economic_fulfillment_acnc_contacts')
  order by created_at asc nulls first
  for update skip locked limit 1;
  if not found then return; end if;
  update public.jobs
  set status='running',worker_id=p_worker_id,started_at=coalesce(started_at,now() at time zone 'UTC'),
      leased_until=now()+make_interval(secs=>greatest(p_lease_seconds,60)),lease_token=gen_random_uuid(),
      attempt_count=coalesce(attempt_count,0)+1,current_state='FULFILLMENT_IN_PROGRESS',last_progress_at=now()
  where id=v_job.id
  returning * into v_job;
  return next v_job;
end;
$function$;