begin;

create or replace function public.enforce_economic_truth_and_action_guards()
returns trigger language plpgsql security definer set search_path=public as $$
declare j jsonb:=to_jsonb(new); n integer; buyers integer; actuator_status text;
begin
 if tg_table_name='economic_outcomes' and coalesce(j->>'truth_status','')='VERIFIED' then
   if not(coalesce((j->'attribution'->>'external_buyer')::boolean,false) and coalesce((j->'attribution'->>'settled_transaction')::boolean,false) and coalesce((j->'attribution'->>'attributed')::boolean,false) and coalesce((j->'attribution'->>'fulfilled')::boolean,false) and coalesce(jsonb_array_length(coalesce(j->'evidence_ids','[]'::jsonb)),0)>=1 and nullif(btrim(j->>'external_reference'),'') is not null) then raise exception 'VERIFIED outcome requires external buyer, settled transaction, attribution, fulfillment and evidence'; end if;
 elsif tg_table_name='economic_events' and coalesce(j->>'verification_status','')='VERIFIED' then
   if not(coalesce(j->>'scope','')='EXTERNAL' and coalesce(j->>'observation_mode','')='OBSERVED' and coalesce((j->>'buyer_action_verified')::boolean,false) and coalesce((j->>'payment_settled')::boolean,false) and coalesce((j->>'fulfilment_verified')::boolean,false) and coalesce((j->>'evidence_verified')::boolean,false) and nullif(j->>'stripe_payment_intent','') is not null and nullif(j->>'stripe_checkout_session','') is not null and nullif(j->>'evidence_ref','') is not null) then raise exception 'VERIFIED economic event requires observed external buyer, settled payment, fulfillment, evidence and Stripe references'; end if;
 elsif tg_table_name='economic_actions' then
   if coalesce(j->>'execution_state','') in('AUTHORIZED','EXECUTING','SUCCEEDED') and coalesce(j->>'authorization_state','')<>'AUTHORIZED' then raise exception 'economic action cannot execute without AUTHORIZED authority state'; end if;
   if coalesce(j->>'execution_state','') in('EXECUTING','SUCCEEDED') or j->>'executed_at' is not null then
     if coalesce(j->>'authorization_state','')<>'AUTHORIZED' then raise exception 'executed economic action requires AUTHORIZED authority state'; end if;
     if coalesce((j->>'approval_required')::boolean,false) and(nullif(j->>'approved_by','') is null or nullif(j->>'approved_at','') is null) then raise exception 'human-approved economic action requires approved_by and approved_at'; end if;
     if nullif(j->>'actuator_id','') is null then raise exception 'economic action requires actuator_id before execution'; end if;
     select status into actuator_status from public.economic_actuators where actuator_id=(j->>'actuator_id');
     if coalesce(actuator_status,'ACTUATOR_UNAVAILABLE')<>'AVAILABLE' then raise exception 'economic action actuator is unavailable'; end if;
     if nullif(j->>'expires_at','') is not null and (j->>'expires_at')::timestamptz<=now() then raise exception 'economic action authorization is expired'; end if;
   end if;
 elsif tg_table_name='commerce_cells' and coalesce(j->>'canonical_state','')='VERIFIED' then
   if not(coalesce((j->>'verified_checkout')::boolean,false) and coalesce((j->>'verified_fulfillment')::boolean,false) and coalesce((j->>'verified_webhook')::boolean,false) and nullif(j->>'evidence_ref','') is not null) then raise exception 'VERIFIED cell requires checkout, webhook, fulfillment and evidence'; end if;
   select count(*) into n from public.economic_outcomes o where o.truth_status='VERIFIED' and(o.offer_id=(j->>'offer_id')::uuid or o.metadata->>'cell_id'=j->>'cell_id');
   if n<1 then raise exception 'VERIFIED cell requires a VERIFIED economic outcome'; end if;
 elsif tg_table_name='commerce_cells' and coalesce(j->>'canonical_state','')='REPLICABLE' then
   select count(*),count(distinct buyer_key_hash) into n,buyers from public.economic_replication where cell_id=(j->>'cell_id')::uuid and outcome_status='VERIFIED';
   if n<2 or buyers<2 then raise exception 'REPLICABLE cell requires two independent verified transactions'; end if;
 end if;
 return new;
end; $$;

revoke all on function public.enforce_economic_truth_and_action_guards() from public,anon,authenticated;
grant execute on function public.enforce_economic_truth_and_action_guards() to service_role;

commit;