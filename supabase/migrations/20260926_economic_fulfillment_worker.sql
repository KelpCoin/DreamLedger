-- Economic fulfillment worker queue RPCs.
-- Applied to project wbwgroygjeyukkspnqiy on 2026-09-26.

create or replace function public.queue_economic_fulfillment_job(p_type text,p_payload jsonb,p_contract_reference text,p_buyer_reference text,p_authorization_state text default 'APPROVED')
returns public.jobs language plpgsql security definer set search_path=public as $$
declare v_job public.jobs%rowtype;
begin
 if p_authorization_state <> 'APPROVED' then raise exception 'ECONOMIC_FULFILLMENT_REQUIRES_APPROVED_AUTHORIZATION'; end if;
 if p_type not in ('economic_fulfillment','economic_fulfillment_public_research','economic_fulfillment_api_extraction','economic_fulfillment_scrape') then raise exception 'ECONOMIC_FULFILLMENT_TYPE_NOT_ALLOWED'; end if;
 if coalesce(trim(p_contract_reference),'')='' then raise exception 'CONTRACT_REFERENCE_REQUIRED'; end if;
 if coalesce(trim(p_buyer_reference),'')='' then raise exception 'BUYER_REFERENCE_REQUIRED'; end if;
 insert into public.jobs(id,type,payload,status,attempt_count,recursion_depth,chain_cost,beck_lifecycle,current_state,next_action,authority_policy,economic_gate_status)
 values(gen_random_uuid(),p_type,coalesce(p_payload,'{}'::jsonb),'queued',0,0,0,'active','QUEUED_FOR_FULFILLMENT',jsonb_build_object('action','lease_economic_fulfillment_job'),jsonb_build_object('authorization_state',p_authorization_state,'contract_reference',p_contract_reference,'buyer_reference',p_buyer_reference),'REVENUE_PATH_CLEAR')
 returning * into v_job;
 return v_job;
end; $$;
revoke all on function public.queue_economic_fulfillment_job(text,jsonb,text,text,text) from public;
grant execute on function public.queue_economic_fulfillment_job(text,jsonb,text,text,text) to service_role;
