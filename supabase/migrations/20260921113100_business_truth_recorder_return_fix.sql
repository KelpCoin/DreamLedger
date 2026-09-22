begin;

create or replace function public.record_economic_outcome(p_offer_id uuid,p_outcome_type text,p_amount_nzd numeric default 0,p_external_reference text default null,p_evidence_id text default null,p_metadata jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare
 v_id uuid; v_candidate uuid; v_action uuid; v_existing uuid; v_evidence uuid[]:='{}'::uuid[];
 v_truth text:='UNVERIFIED'; v_meta jsonb:=coalesce(p_metadata,'{}'::jsonb); v_evidence_count integer:=0;
begin
 if p_outcome_type not in('PAYMENT_ATTEMPT','PAID','REFUNDED','FULFILLED','REPEAT_PURCHASE') then raise exception 'unsupported economic outcome type: %',p_outcome_type; end if;
 if p_evidence_id is not null and p_evidence_id~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
   v_evidence:=array[p_evidence_id::uuid];
   select count(*) into v_evidence_count from public.control_evidence ce where ce.evidence_id=p_evidence_id::uuid;
 end if;
 if coalesce(v_meta->>'classification','')='TEST' then
   v_truth:='TEST';
 elsif coalesce(v_meta->>'classification','')='OBSERVED'
   and coalesce(v_meta->>'scope','INTERNAL')='EXTERNAL'
   and coalesce((v_meta->>'livemode')::boolean,false)
   and coalesce((v_meta->>'external_buyer')::boolean,false)
   and coalesce((v_meta->>'settled_transaction')::boolean,false)
   and coalesce((v_meta->>'attributed')::boolean,false)
   and coalesce((v_meta->>'fulfilled')::boolean,false)
   and v_evidence_count>=1
   and p_external_reference is not null then
   v_truth:='VERIFIED';
 end if;
 select eo.outcome_id into v_existing from public.economic_outcomes eo
 where p_external_reference is not null and eo.external_reference=p_external_reference and eo.outcome_type=p_outcome_type limit 1;
 if v_existing is not null then return v_existing; end if;
 select ea.candidate_id,ea.action_id into v_candidate,v_action from public.economic_actions ea
 where ea.offer_id=p_offer_id order by ea.created_at desc nulls last limit 1;
 insert into public.economic_outcomes(candidate_id,action_id,offer_id,outcome_type,amount_nzd,founder_minutes,fulfilment_minutes,acquisition_cost_nzd,payment_fees_nzd,external_reference,observed_at,evidence_ids,metadata,truth_status,attribution)
 values(v_candidate,v_action,p_offer_id,p_outcome_type,coalesce(p_amount_nzd,0),0,0,0,0,p_external_reference,now(),v_evidence,v_meta||jsonb_build_object('recorder','record_economic_outcome','schema_version',4),v_truth,jsonb_build_object('external_buyer',coalesce((v_meta->>'external_buyer')::boolean,false),'settled_transaction',coalesce((v_meta->>'settled_transaction')::boolean,false),'attributed',coalesce((v_meta->>'attributed')::boolean,false),'fulfilled',coalesce((v_meta->>'fulfilled')::boolean,false),'external_reference',p_external_reference,'livemode',coalesce((v_meta->>'livemode')::boolean,false)))
 returning outcome_id into v_id;
 return v_id;
end; $$;

create or replace function public.capture_economic_payment_outcome()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_offer uuid; v_amount numeric; v_event jsonb; v_customer text; v_classification text; v_livemode boolean;
begin
 if new.payment_settled is not true then return new; end if;
 v_amount:=coalesce(new.amount_nzd,0); v_offer:=public.resolve_economic_offer_id(new.offer_id,new.sku_id,v_amount); if v_offer is null then return new; end if;
 select payload into v_event from public.stripe_webhook_events where event_id=new.event_id limit 1;
 v_customer:=v_event->'data'->'object'->'customer_details'->>'email';
 v_livemode:=coalesce((v_event->>'livemode')::boolean,false);
 v_classification:=case when v_livemode then 'OBSERVED' else 'TEST' end;
 perform public.record_economic_outcome(v_offer,'PAID',v_amount,coalesce(new.stripe_checkout_session,new.event_id),new.evidence_ref,jsonb_build_object('classification',v_classification,'scope','EXTERNAL','livemode',v_livemode,'external_buyer',v_customer is not null,'settled_transaction',true,'attributed',new.stripe_checkout_session is not null and new.event_id is not null,'fulfilled',false,'sku_id',new.sku_id,'offer_key',new.offer_id,'source','economic_events_trigger'));
 return new;
end; $$;

revoke all on function public.record_economic_outcome(uuid,text,numeric,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.capture_economic_payment_outcome() from public,anon,authenticated;
grant execute on function public.record_economic_outcome(uuid,text,numeric,text,text,jsonb) to service_role;
grant execute on function public.capture_economic_payment_outcome() to service_role;

commit;