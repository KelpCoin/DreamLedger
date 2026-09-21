begin;

create unique index if not exists fulfillment_requests_entitlement_uq on public.fulfillment_requests(entitlement_id);

create or replace function public.enforce_economic_truth_and_action_guards()
returns trigger language plpgsql security definer set search_path=public as $$
declare n integer; buyers integer; actuator_status text;
begin
 if tg_table_name='economic_outcomes' and new.truth_status='VERIFIED' then
   if not(coalesce((new.attribution->>'external_buyer')::boolean,false) and coalesce((new.attribution->>'settled_transaction')::boolean,false) and coalesce((new.attribution->>'attributed')::boolean,false) and coalesce((new.attribution->>'fulfilled')::boolean,false) and coalesce(cardinality(new.evidence_ids),0)>=1 and new.external_reference is not null and btrim(new.external_reference)<>'') then
     raise exception 'VERIFIED outcome requires external buyer, settled transaction, attribution, fulfillment and evidence';
   end if;
 elsif tg_table_name='economic_events' and new.verification_status='VERIFIED' then
   if not(new.scope='EXTERNAL' and new.observation_mode='OBSERVED' and new.buyer_action_verified and new.payment_settled and new.fulfilment_verified and new.evidence_verified and new.stripe_payment_intent is not null and new.stripe_checkout_session is not null and new.evidence_ref is not null) then
     raise exception 'VERIFIED economic event requires observed external buyer, settled payment, fulfillment, evidence and Stripe references';
   end if;
 elsif tg_table_name='economic_actions' then
   if new.execution_state in('AUTHORIZED','EXECUTING','SUCCEEDED') and new.authorization_state<>'AUTHORIZED' then raise exception 'economic action cannot execute without AUTHORIZED authority state'; end if;
   if new.execution_state in('EXECUTING','SUCCEEDED') or new.executed_at is not null then
     if new.authorization_state<>'AUTHORIZED' then raise exception 'executed economic action requires AUTHORIZED authority state'; end if;
     if new.approval_required and(new.approved_by is null or new.approved_at is null) then raise exception 'human-approved economic action requires approved_by and approved_at'; end if;
     if new.actuator_id is null then raise exception 'economic action requires actuator_id before execution'; end if;
     select status into actuator_status from public.economic_actuators where actuator_id=new.actuator_id;
     if coalesce(actuator_status,'ACTUATOR_UNAVAILABLE')<>'AVAILABLE' then raise exception 'economic action actuator is unavailable'; end if;
     if new.expires_at is not null and new.expires_at<=now() then raise exception 'economic action authorization is expired'; end if;
   end if;
 elsif tg_table_name='commerce_cells' and new.canonical_state='VERIFIED' then
   if not(new.verified_checkout and new.verified_fulfillment and new.verified_webhook and new.evidence_ref is not null) then raise exception 'VERIFIED cell requires checkout, webhook, fulfillment and evidence'; end if;
   select count(*) into n from public.economic_outcomes o where o.truth_status='VERIFIED' and(o.offer_id=new.offer_id or o.metadata->>'cell_id'=new.cell_id::text);
   if n<1 then raise exception 'VERIFIED cell requires a VERIFIED economic outcome'; end if;
 elsif tg_table_name='commerce_cells' and new.canonical_state='REPLICABLE' then
   select count(*),count(distinct buyer_key_hash) into n,buyers from public.economic_replication where cell_id=new.cell_id and outcome_status='VERIFIED';
   if n<2 or buyers<2 then raise exception 'REPLICABLE cell requires two independent verified transactions'; end if;
 end if;
 return new;
end; $$;

revoke all on function public.enforce_economic_truth_and_action_guards() from public,anon,authenticated;
grant execute on function public.enforce_economic_truth_and_action_guards() to service_role;

drop trigger if exists trg_economic_truth_guards_cells on public.commerce_cells;
create trigger trg_economic_truth_guards_cells before insert or update on public.commerce_cells for each row execute function public.enforce_economic_truth_and_action_guards();
drop trigger if exists trg_economic_truth_guards_actions on public.economic_actions;
create trigger trg_economic_truth_guards_actions before insert or update on public.economic_actions for each row execute function public.enforce_economic_truth_and_action_guards();
drop trigger if exists trg_economic_truth_guards_events on public.economic_events;
create trigger trg_economic_truth_guards_events before insert or update on public.economic_events for each row execute function public.enforce_economic_truth_and_action_guards();
drop trigger if exists trg_economic_truth_guards_outcomes on public.economic_outcomes;
create trigger trg_economic_truth_guards_outcomes before insert or update on public.economic_outcomes for each row execute function public.enforce_economic_truth_and_action_guards();

create or replace function public.record_economic_outcome(p_offer_id uuid,p_outcome_type text,p_amount_nzd numeric default 0,p_external_reference text default null,p_evidence_id text default null,p_metadata jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_candidate uuid; v_action uuid; v_existing uuid; v_evidence uuid[]:='{}'::uuid[]; v_truth text:='UNVERIFIED'; v_meta jsonb:=coalesce(p_metadata,'{}'::jsonb);
begin
 if p_outcome_type not in('PAYMENT_ATTEMPT','PAID','REFUNDED','FULFILLED','REPEAT_PURCHASE') then raise exception 'unsupported economic outcome type: %',p_outcome_type; end if;
 if p_evidence_id is not null and p_evidence_id~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then v_evidence:=array[p_evidence_id::uuid]; end if;
 if coalesce(v_meta->>'classification','')='TEST' then v_truth:='TEST';
 elsif coalesce(v_meta->>'classification','')='OBSERVED' and coalesce(v_meta->>'scope','INTERNAL')='EXTERNAL' and coalesce((v_meta->>'external_buyer')::boolean,false) and coalesce((v_meta->>'settled_transaction')::boolean,false) and coalesce((v_meta->>'attributed')::boolean,false) and coalesce((v_meta->>'fulfilled')::boolean,false) and cardinality(v_evidence)>=1 and p_external_reference is not null then v_truth:='VERIFIED'; end if;
 select eo.outcome_id into v_existing from public.economic_outcomes eo where p_external_reference is not null and eo.external_reference=p_external_reference and eo.outcome_type=p_outcome_type limit 1;
 if v_existing is not null then return v_existing; end if;
 select ea.candidate_id,ea.action_id into v_candidate,v_action from public.economic_actions ea where ea.offer_id=p_offer_id order by ea.created_at desc nulls last limit 1;
 insert into public.economic_outcomes(candidate_id,action_id,offer_id,outcome_type,amount_nzd,founder_minutes,fulfilment_minutes,acquisition_cost_nzd,payment_fees_nzd,external_reference,observed_at,evidence_ids,metadata,truth_status,attribution)
 values(v_candidate,v_action,p_offer_id,p_outcome_type,coalesce(p_amount_nzd,0),0,0,0,0,p_external_reference,now(),v_evidence,v_meta||jsonb_build_object('recorder','record_economic_outcome','schema_version',3),v_truth,jsonb_build_object('external_buyer',coalesce((v_meta->>'external_buyer')::boolean,false),'settled_transaction',coalesce((v_meta->>'settled_transaction')::boolean,false),'attributed',coalesce((v_meta->>'attributed')::boolean,false),'fulfilled',coalesce((v_meta->>'fulfilled')::boolean,false),'external_reference',p_external_reference))
 returning outcome_id into v_id;
 return v_id;
end; $$;

revoke all on function public.record_economic_outcome(uuid,text,numeric,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.record_economic_outcome(uuid,text,numeric,text,text,jsonb) to service_role;

create or replace function public.capture_economic_payment_outcome()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_offer uuid; v_amount numeric; v_event jsonb; v_customer text; v_classification text;
begin
 if new.payment_settled is not true then return new; end if;
 v_amount:=coalesce(new.amount_nzd,0); v_offer:=public.resolve_economic_offer_id(new.offer_id,new.sku_id,v_amount); if v_offer is null then return new; end if;
 select payload into v_event from public.stripe_webhook_events where event_id=new.event_id limit 1;
 v_customer:=v_event->'data'->'object'->'customer_details'->>'email';
 v_classification:=case when coalesce((v_event->>'livemode')::boolean,false) then 'OBSERVED' else 'TEST' end;
 perform public.record_economic_outcome(v_offer,'PAID',v_amount,coalesce(new.stripe_checkout_session,new.event_id),new.evidence_ref,jsonb_build_object('classification',v_classification,'scope','EXTERNAL','external_buyer',v_customer is not null,'settled_transaction',true,'attributed',new.stripe_checkout_session is not null and new.event_id is not null,'fulfilled',false,'sku_id',new.sku_id,'offer_key',new.offer_id,'source','economic_events_trigger'));
 return new;
end; $$;

drop trigger if exists trg_economic_events_capture_paid on public.economic_events;
create trigger trg_economic_events_capture_paid after insert or update of payment_settled on public.economic_events for each row execute function public.capture_economic_payment_outcome();

create or replace function public.capture_economic_fulfillment_outcome()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_order uuid; v_amount numeric; v_reference text; v_customer text; v_outcome uuid; v_meta jsonb;
begin
 if lower(coalesce(new.status,'')) not in('fulfilled','completed','complete','delivered') and upper(coalesce(new.canonical_state,''))<>'FULFILLED' then return new; end if;
 select re.order_id,ro.amount_nzd,ro.stripe_checkout_session_id,ro.customer_email into v_order,v_amount,v_reference,v_customer from public.revenue_entitlements re join public.revenue_orders ro on ro.id=re.order_id where re.id=new.entitlement_id limit 1;
 if v_order is null then return new; end if;
 v_meta:=jsonb_build_object('classification','OBSERVED','scope','EXTERNAL','external_buyer',v_customer is not null,'settled_transaction',true,'attributed',v_reference is not null,'fulfilled',true,'source','fulfillment_requests_trigger','fulfillment_request_id',new.id,'sku_id',new.sku_id,'fulfillment_reference',coalesce(new.fulfillment_reference,new.confirmation_reference,new.id::text));
 select outcome_id into v_outcome from public.economic_outcomes where outcome_type='PAID' and external_reference=v_reference order by observed_at desc limit 1;
 if v_outcome is not null and v_customer is not null and v_reference is not null then
   update public.economic_outcomes set truth_status='VERIFIED',evidence_ids=case when new.id=any(evidence_ids) then evidence_ids else evidence_ids||new.id end,metadata=metadata||v_meta,attribution=jsonb_build_object('external_buyer',true,'settled_transaction',true,'attributed',true,'fulfilled',true,'external_reference',v_reference) where outcome_id=v_outcome;
 else
   return new;
 end if;
 return new;
end; $$;

drop trigger if exists trg_fulfillment_requests_capture_outcome on public.fulfillment_requests;
create trigger trg_fulfillment_requests_capture_outcome after insert or update of status,canonical_state on public.fulfillment_requests for each row execute function public.capture_economic_fulfillment_outcome();

revoke all on function public.capture_economic_payment_outcome() from public,anon,authenticated;
revoke all on function public.capture_economic_fulfillment_outcome() from public,anon,authenticated;
grant execute on function public.capture_economic_payment_outcome() to service_role;
grant execute on function public.capture_economic_fulfillment_outcome() to service_role;

commit;