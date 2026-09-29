-- Reconnect already-prepared economic packets to the external actuator only after
-- a valid single-use economic action authorization exists.
create or replace function public.requeue_internal_routed_external_packets(p_limit integer default 10)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare p record; j uuid; n integer:=0; ready boolean;
begin
 if p_limit<1 or p_limit>50 then raise exception 'limit must be 1..50'; end if;
 ready:=exists(select 1 from public.economic_actuators where actuator_id='generic_external_action' and status='AVAILABLE' and last_observed_at is not null and last_observed_at>now()-interval '2 minutes');
 if not ready then return jsonb_build_object('requeued',0,'external_actuator_ready',false); end if;

 for p in
   select ep.*, oldj.id as old_job_id
   from public.economic_execution_packets ep
   left join public.jobs oldj on oldj.id=ep.job_id
   where ep.status='DISPATCHED'
     and ep.dispatch_state='INTERNAL_ROUTED'
     and coalesce((ep.exact_action->>'external_action_allowed')::boolean,false)
     and coalesce((ep.authority_policy->>'authorized')::boolean,false)
     and coalesce((ep.authority_policy->>'lane'),'RED')='GREEN'
     and exists(select 1 from public.economic_action_authorizations aa
                where aa.packet_id=ep.packet_id and aa.decision='APPROVE' and aa.expires_at>now())
     and (ep.job_id is null or oldj.type='CUBE_REFINERY_RESEARCH')
     and (ep.job_id is null or oldj.status in ('completed','failed'))
   order by ep.created_at
   limit p_limit for update of ep skip locked
 loop
   insert into public.jobs(type,payload,status,attempt_count,objective_text,success_condition,failure_condition,authority_policy,budget_policy,current_state,next_action)
   values('EXTERNAL_ACTION',jsonb_build_object(
     'economic_packet_id',p.packet_id,'opportunity_id',p.opportunity_id,'capability_id',p.capability_id,
     'exact_action',p.exact_action,'predicted_postcondition',p.predicted_postcondition,
     'verification_predicate',p.verification_predicate,'kill_conditions',p.kill_conditions,'external_action_allowed',true),
     'pending',0,p.objective,jsonb_build_object('observable_external_result_required',true,'external_action_required',true),
     jsonb_build_object('capability_unverified',true,'scope_expanded',true,'counterparty_unknown',true),
     p.authority_policy,p.budget_policy,'pending',
     jsonb_build_object('packet_id',p.packet_id,'action_type',coalesce(p.exact_action->>'action_type','EXTERNAL_ACTION'),'lane','GREEN')) returning id into j;

   update public.economic_execution_packets set job_id=j,updated_at=now() where packet_id=p.packet_id;
   insert into public.economic_job_events(job_id,opportunity_id,to_state,event_type,actor,evidence)
   values(j,p.opportunity_id,'DISPATCHED','EXTERNAL_ACTION_JOB_CREATED','external-actuator-frontier-recovery',
     jsonb_build_object('packet_id',p.packet_id,'external_action_allowed',true,'authority_lane','GREEN',
       'actuator_id','generic_external_action','recovered_from_dispatch_state','INTERNAL_ROUTED',
       'replaced_internal_job_id',p.old_job_id,'human_approval_required','valid_economic_action_authorization'));
   n:=n+1;
 end loop;

 return jsonb_build_object('requeued',n,'external_actuator_ready',true);
end; $$;

create or replace function public.record_external_action_result(p_job_id uuid,p_lease_token uuid,p_dispatch_state text,p_evidence jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare j public.jobs; packet public.economic_execution_packets;
begin
 if p_dispatch_state not in ('EXTERNAL_SENT','EXTERNAL_RESULT_OBSERVED') then raise exception 'invalid external dispatch state'; end if;
 select * into j from public.jobs where id=p_job_id and status='leased' and lease_token=p_lease_token;
 if not found then raise exception 'leased external action job not found'; end if;
 select * into packet from public.economic_execution_packets where packet_id=(j.payload->>'economic_packet_id')::uuid for update;
 if not found then raise exception 'economic packet not found'; end if;
 if packet.dispatch_state not in ('INTERNAL_ROUTED','EXTERNAL_SENT','EXTERNAL_RESULT_OBSERVED') then raise exception 'invalid packet dispatch transition from %',packet.dispatch_state; end if;
 update public.economic_execution_packets set dispatch_state=p_dispatch_state,updated_at=now() where packet_id=packet.packet_id;
 update public.jobs set result_payload=coalesce(result_payload,'{}'::jsonb)||jsonb_build_object('external_dispatch_state',p_dispatch_state,'external_evidence',p_evidence),last_progress_at=now(),last_evidence_at=now() where id=p_job_id;
 insert into public.economic_job_events(job_id,opportunity_id,to_state,event_type,actor,evidence)
 values(p_job_id,packet.opportunity_id,'DISPATCHED','JOB_STATE_CHANGED','external-actuator',jsonb_build_object('packet_id',packet.packet_id,'dispatch_state',p_dispatch_state,'external_evidence',p_evidence));
 return jsonb_build_object('ok',true,'job_id',p_job_id,'packet_id',packet.packet_id,'dispatch_state',p_dispatch_state);
end; $$;
