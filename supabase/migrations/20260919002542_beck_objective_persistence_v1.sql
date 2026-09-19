alter table public.jobs
  add column if not exists beck_lifecycle text,
  add column if not exists beck_objective_id uuid,
  add column if not exists beck_success_condition_hash text,
  add column if not exists beck_raw_lm_output text,
  add column if not exists beck_structured_lm_output jsonb,
  add column if not exists beck_action_id text,
  add column if not exists beck_evidence_ids uuid[],
  add column if not exists beck_last_heartbeat_at timestamptz,
  add column if not exists beck_terminal_result jsonb;

alter table public.jobs drop constraint if exists jobs_beck_lifecycle_check;
alter table public.jobs add constraint jobs_beck_lifecycle_check check (beck_lifecycle is null or beck_lifecycle in ('active','paused','blocked','complete','killed'));
create index if not exists jobs_beck_objective_idx on public.jobs(beck_objective_id,status,created_at);
create index if not exists jobs_beck_claim_idx on public.jobs(type,status,leased_until,created_at) where type like 'beck_%';

create or replace function public.beck_success_condition_hash() returns text language sql immutable as $$ select encode(extensions.digest(convert_to('external settled Stripe payment -> attributable revenue/order -> fulfillment record -> persisted evidence','utf8'),'sha256'),'hex') $$;
create or replace function public.beck_guard_success_condition() returns trigger language plpgsql as $$
begin
 if tg_op='UPDATE' and old.beck_success_condition_hash is not null and new.beck_success_condition_hash is distinct from old.beck_success_condition_hash then raise exception 'BECK_SUCCESS_CONDITION_IMMUTABLE'; end if;
 if tg_op='INSERT' and new.beck_success_condition_hash is not null and new.beck_success_condition_hash <> public.beck_success_condition_hash() then raise exception 'BECK_SUCCESS_CONDITION_MISMATCH'; end if;
 return new;
end $$;
drop trigger if exists trg_beck_success_condition_immutable on public.jobs;
create trigger trg_beck_success_condition_immutable before insert or update on public.jobs for each row execute function public.beck_guard_success_condition();

create or replace function public.beck_create_objective(p_objective text,p_silo_id text default 'SILO_GENERAL') returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if coalesce(pg_catalog.btrim(p_objective),'')='' then raise exception 'objective required'; end if;
 insert into public.jobs(type,status,payload,beck_lifecycle,beck_success_condition_hash) values('beck_objective','pending',pg_catalog.jsonb_build_object('objective',p_objective,'silo_id',coalesce(p_silo_id,'SILO_GENERAL'),'economic_status','NOT_YET_PROVEN'),'active',public.beck_success_condition_hash()) returning id into v_id;
 return v_id;
end $$;

create or replace function public.beck_kill_objective(p_objective_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.jobs;
begin
 update public.jobs set beck_lifecycle='killed' where id=p_objective_id and type='beck_objective' and beck_lifecycle in ('active','paused','blocked') returning * into v;
 if not found then
  select * into v from public.jobs where id=p_objective_id and type='beck_objective';
  if not found then return pg_catalog.jsonb_build_object('status','NOT_FOUND'); end if;
  return pg_catalog.jsonb_build_object('status','TERMINAL','lifecycle',v.beck_lifecycle);
 end if;
 return pg_catalog.jsonb_build_object('status','KILLED','objective_id',v.id,'in_flight_work_not_terminated',true);
end $$;

create or replace function public.beck_authorize_action(p_objective_id uuid,p_action_id text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.jobs;
begin
 select * into v from public.jobs where id=p_objective_id and type='beck_objective';
 if not found then return pg_catalog.jsonb_build_object('allowed',false,'reason','OBJECTIVE_NOT_FOUND'); end if;
 if v.beck_lifecycle <> 'active' then return pg_catalog.jsonb_build_object('allowed',false,'reason','OBJECTIVE_LIFECYCLE_'||upper(v.beck_lifecycle)); end if;
 if p_action_id in ('LOOP_001_OBSERVE','LOOP_002_NORMALIZE','LOOP_003_DEMAND_SCAN','LOOP_004_SYNTHESIZE') then return pg_catalog.jsonb_build_object('allowed',true,'action_id',p_action_id,'external_effects',false); end if;
 return pg_catalog.jsonb_build_object('allowed',false,'reason','UNKNOWN_ACTION_ID');
end $$;

create or replace function public.claim_beck_objective_job(p_worker_id text,p_lease_seconds integer default 300) returns public.jobs language plpgsql security definer set search_path='' as $$
declare v public.jobs;
begin
 if p_worker_id is null or pg_catalog.btrim(p_worker_id)='' then raise exception 'worker required'; end if;
 if p_lease_seconds < 30 or p_lease_seconds > 3600 then raise exception 'invalid lease'; end if;
 with candidate as (
  select j.id from public.jobs j join public.jobs o on o.id=j.beck_objective_id
  where j.type in ('beck_loop_001','beck_loop_002','beck_loop_003','beck_loop_004')
   and (j.status='pending' or (j.status='leased' and j.leased_until < pg_catalog.now()))
   and coalesce(j.attempt_count,0) < 10 and o.type='beck_objective' and o.beck_lifecycle='active'
   and (j.type <> 'beck_loop_002' or exists(select 1 from public.cube_evidence_vault e where e.silo_id=coalesce(o.payload->>'silo_id','SILO_GENERAL') and e.source='beck.loop.001' and e.verification_status='VERIFIED' and e.created_at>pg_catalog.now()-interval '24 hours'))
   and (j.type <> 'beck_loop_004' or exists(select 1 from public.cube_evidence_vault e where e.silo_id=coalesce(o.payload->>'silo_id','SILO_GENERAL') and e.source in ('beck.loop.001','beck.loop.002','beck.loop.003') and e.created_at>pg_catalog.now()-interval '24 hours' and e.verification_status in ('VERIFIED','UNVERIFIED')))
  order by case when j.status='leased' then 0 else 1 end,j.created_at,j.id for update of j skip locked limit 1
 )
 update public.jobs j set status='leased',worker_id=p_worker_id,lease_token=pg_catalog.gen_random_uuid(),leased_until=pg_catalog.now()+pg_catalog.make_interval(secs=>p_lease_seconds),started_at=coalesce(j.started_at,pg_catalog.now()),attempt_count=coalesce(j.attempt_count,0)+1,completed_at=null,last_error=null from candidate c where j.id=c.id returning j.* into v;
 return v;
end $$;

create or replace function public.complete_beck_job(p_job_id uuid,p_worker_id text,p_lease_token uuid,p_result jsonb,p_terminal boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.jobs; o public.jobs;
begin
 select * into j from public.jobs where id=p_job_id;
 if not found then return pg_catalog.jsonb_build_object('status','NOT_FOUND'); end if;
 if j.status in ('completed','failed') or j.beck_terminal_result is not null then return pg_catalog.jsonb_build_object('status','TERMINAL_IDEMPOTENT','job_id',p_job_id,'existing_status',j.status); end if;
 if j.worker_id is distinct from p_worker_id or j.lease_token is distinct from p_lease_token then return pg_catalog.jsonb_build_object('status','STALE_LEASE_REJECTED','job_id',p_job_id); end if;
 if j.leased_until is null or j.leased_until < pg_catalog.now() then return pg_catalog.jsonb_build_object('status','EXPIRED_LEASE_REJECTED','job_id',p_job_id); end if;
 if j.beck_objective_id is not null then
  select * into o from public.jobs where id=j.beck_objective_id;
  if o.beck_lifecycle='killed' then
   update public.jobs set status='completed',completed_at=pg_catalog.now(),leased_until=null,worker_id=null,lease_token=null,result_payload=p_result,beck_terminal_result=pg_catalog.jsonb_build_object('outcome','KILLED_DURING_WORK') where id=j.id and status='leased' and worker_id=p_worker_id and lease_token=p_lease_token;
   return pg_catalog.jsonb_build_object('status','KILLED_DURING_WORK','objective_id',o.id);
  end if;
 end if;
 update public.jobs set status='completed',completed_at=pg_catalog.now(),leased_until=null,worker_id=null,lease_token=null,result_payload=p_result,beck_terminal_result=case when p_terminal then p_result else null end where id=j.id and status='leased' and worker_id=p_worker_id and lease_token=p_lease_token;
 if not found then return pg_catalog.jsonb_build_object('status','STALE_LEASE_REJECTED','job_id',p_job_id); end if;
 return pg_catalog.jsonb_build_object('status','COMPLETED','job_id',p_job_id);
end $$;

create or replace function public.beck_record_lm_output(p_job_id uuid,p_raw text,p_structured jsonb default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.jobs; v_raw uuid; v_struct uuid; v_action text;
begin
 select * into j from public.jobs where id=p_job_id;
 if not found then return pg_catalog.jsonb_build_object('status','NOT_FOUND'); end if;
 insert into public.cube_evidence_vault(silo_id,source,observation,verification_status,source_ref,content_hash)
 values(coalesce((select payload->>'silo_id' from public.jobs where id=j.beck_objective_id),'BECK'),'beck.lm.raw',pg_catalog.jsonb_build_object('job_id',p_job_id,'raw_output',p_raw),'UNVERIFIED','job:'||p_job_id::text,encode(extensions.digest(convert_to(p_raw,'utf8'),'sha256'),'hex')) returning evidence_id into v_raw;
 if p_structured is null then
  update public.jobs set beck_raw_lm_output=p_raw,status=case when coalesce(attempt_count,0)>=10 then 'failed' else 'pending' end,last_error='INVALID_LM_JSON' where id=p_job_id;
  return pg_catalog.jsonb_build_object('status','INVALID_JSON','raw_evidence_id',v_raw);
 end if;
 v_action:=p_structured->>'action_id';
 if jsonb_typeof(p_structured)<>'object' or v_action is null or jsonb_typeof(p_structured->'action_id')<>'string' then
  update public.jobs set beck_raw_lm_output=p_raw,status=case when coalesce(attempt_count,0)>=10 then 'failed' else 'pending' end,last_error='INVALID_LM_SCHEMA' where id=p_job_id;
  return pg_catalog.jsonb_build_object('status','INVALID_SCHEMA','raw_evidence_id',v_raw);
 end if;
 if not (v_action in ('LOOP_001_OBSERVE','LOOP_002_NORMALIZE','LOOP_003_DEMAND_SCAN','LOOP_004_SYNTHESIZE')) then
  update public.jobs set beck_raw_lm_output=p_raw,status=case when coalesce(attempt_count,0)>=10 then 'failed' else 'pending' end,last_error='INVALID_ACTION_ID' where id=p_job_id;
  return pg_catalog.jsonb_build_object('status','INVALID_ACTION_ID','raw_evidence_id',v_raw);
 end if;
 insert into public.cube_evidence_vault(silo_id,source,observation,verification_status,source_ref,content_hash)
 values(coalesce((select payload->>'silo_id' from public.jobs where id=j.beck_objective_id),'BECK'),'beck.lm.structured',p_structured,'UNVERIFIED','job:'||p_job_id::text,encode(extensions.digest(convert_to(p_structured::text,'utf8'),'sha256'),'hex')) returning evidence_id into v_struct;
 update public.jobs set beck_raw_lm_output=p_raw,beck_structured_lm_output=p_structured,beck_action_id=v_action where id=p_job_id;
 return pg_catalog.jsonb_build_object('status','UNVERIFIED_VALID','raw_evidence_id',v_raw,'structured_evidence_id',v_struct,'action_id',v_action);
end $$;

create or replace function public.beck_heartbeat(p_worker_id text,p_objective_id uuid default null,p_state text default 'RUNNING') returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 insert into public.telemetry_events(event_type,tenant_id,payload,event_timestamp) values('BECK_HEARTBEAT',null,pg_catalog.jsonb_build_object('worker_id',p_worker_id,'objective_id',p_objective_id,'state',p_state,'observed_at',pg_catalog.now()),pg_catalog.now()) returning id into v_id;
 if p_objective_id is not null then update public.jobs set beck_last_heartbeat_at=pg_catalog.now() where id=p_objective_id and type='beck_objective'; end if;
 return v_id;
end $$;

create or replace function public.beck_verify_objective(p_objective_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.jobs; r record; v_evidence uuid;
begin
 select * into o from public.jobs where id=p_objective_id and type='beck_objective';
 if not found then return pg_catalog.jsonb_build_object('status','NOT_FOUND'); end if;
 if o.beck_lifecycle in ('complete','killed') then return pg_catalog.jsonb_build_object('status','TERMINAL_IDEMPOTENT','lifecycle',o.beck_lifecycle); end if;
 select ro.id,ro.stripe_event_id,ro.stripe_payment_intent_id,ro.stripe_checkout_session_id,ro.sku_id,ro.amount_nzd,ro.currency,ro.status,ro.paid_at,
 exists(select 1 from public.revenue_entitlements re join public.fulfillment_requests fr on fr.entitlement_id=re.id where re.order_id=ro.id and fr.status in ('fulfilled','completed','delivered')) as fulfillment
 into r from public.revenue_orders ro
 where lower(ro.status)='paid' and ro.stripe_payment_intent_id is not null
  and exists(select 1 from public.revenue_entitlements re where re.order_id=ro.id)
  and exists(select 1 from public.revenue_entitlements re join public.fulfillment_requests fr on fr.entitlement_id=re.id where re.order_id=ro.id and fr.status in ('fulfilled','completed','delivered'))
 order by ro.paid_at asc limit 1;
 if not found then return pg_catalog.jsonb_build_object('status','NOT_YET_PROVEN','economic_status','NOT_YET_PROVEN','external_payment_found',false); end if;
 insert into public.cube_evidence_vault(silo_id,source,observation,verification_status,source_ref,content_hash,outcome)
 values(coalesce(o.payload->>'silo_id','BECK'),'beck.economic.verifier',pg_catalog.jsonb_build_object('stripe_event_id',r.stripe_event_id,'stripe_payment_intent_id',r.stripe_payment_intent_id,'stripe_checkout_session_id',r.stripe_checkout_session_id,'sku_id',r.sku_id,'amount_nzd',r.amount_nzd,'currency',r.currency,'paid_at',r.paid_at,'fulfillment',r.fulfillment),'VERIFIED','revenue_order:'||r.id::text,encode(extensions.digest(convert_to(pg_catalog.jsonb_build_object('stripe_event_id',r.stripe_event_id,'stripe_payment_intent_id',r.stripe_payment_intent_id,'stripe_checkout_session_id',r.stripe_checkout_session_id,'sku_id',r.sku_id,'amount_nzd',r.amount_nzd,'currency',r.currency,'paid_at',r.paid_at,'fulfillment',r.fulfillment)::text,'utf8'),'sha256'),'hex'),pg_catalog.jsonb_build_object('business_truth','VERIFIED','revenue_nzd',r.amount_nzd)) returning evidence_id into v_evidence;
 update public.jobs set beck_lifecycle='complete',beck_terminal_result=pg_catalog.jsonb_build_object('economic_status','VERIFIED','revenue_nzd',r.amount_nzd,'revenue_order_id',r.id,'evidence_id',v_evidence) where id=o.id and beck_lifecycle='active';
 return pg_catalog.jsonb_build_object('status','VERIFIED','objective_id',o.id,'evidence_id',v_evidence,'revenue_nzd',r.amount_nzd);
end $$;

revoke all on function public.beck_create_objective(text,text),public.beck_kill_objective(uuid),public.beck_authorize_action(uuid,text),public.claim_beck_objective_job(text,integer),public.complete_beck_job(uuid,text,uuid,jsonb,boolean),public.beck_record_lm_output(uuid,text,jsonb),public.beck_heartbeat(text,uuid,text),public.beck_verify_objective(uuid) from public;
grant execute on function public.beck_create_objective(text,text),public.beck_kill_objective(uuid),public.beck_authorize_action(uuid,text),public.claim_beck_objective_job(text,integer),public.complete_beck_job(uuid,text,uuid,jsonb,boolean),public.beck_record_lm_output(uuid,text,jsonb),public.beck_heartbeat(text,uuid,text),public.beck_verify_objective(uuid) to service_role;
