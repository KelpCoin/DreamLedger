-- Historical migration-history reconciliation marker.
-- The live project recorded this change under this timestamp; the canonical
-- implementation is retained in the later source migration as well.

begin;

create or replace function public.enforce_economic_truth_and_action_guards()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  j jsonb:=to_jsonb(new);
  n integer;
  buyers integer;
  evidence_total integer;
  evidence_valid integer;
  actuator_status text;
begin
  if tg_table_name='economic_outcomes' and coalesce(j->>'truth_status','')='VERIFIED' then
    select
      coalesce(array_length(new.evidence_ids,1),0),
      count(ce.evidence_id)
    into evidence_total,evidence_valid
    from public.control_evidence ce
    where ce.evidence_id = any(coalesce(new.evidence_ids,'{}'::uuid[]))
      and (ce.expires_at is null or ce.expires_at>now());

    if not(
      coalesce((j->'attribution'->>'external_buyer')::boolean,false)
      and coalesce((j->'attribution'->>'settled_transaction')::boolean,false)
      and coalesce((j->'attribution'->>'attributed')::boolean,false)
      and coalesce((j->'attribution'->>'fulfilled')::boolean,false)
      and coalesce((j->'attribution'->>'livemode')::boolean,false)
      and nullif(btrim(j->>'external_reference'),'') is not null
      and evidence_total>=1
      and evidence_valid=evidence_total
    ) then
      raise exception 'VERIFIED outcome requires live external buyer, settled payment, attribution, fulfillment, non-expired control evidence and external reference';
    end if;

  elsif tg_table_name='economic_events' and coalesce(j->>'verification_status','')='VERIFIED' then
    if not(
      coalesce(j->>'scope','')='EXTERNAL'
      and coalesce(j->>'observation_mode','')='OBSERVED'
      and coalesce((j->>'buyer_action_verified')::boolean,false)
      and coalesce((j->>'payment_settled')::boolean,false)
      and coalesce((j->>'fulfilment_verified')::boolean,false)
      and coalesce((j->>'evidence_verified')::boolean,false)
      and nullif(j->>'stripe_payment_intent','') is not null
      and nullif(j->>'stripe_checkout_session','') is not null
      and nullif(j->>'evidence_ref','') is not null
      and exists(
        select 1 from public.control_evidence ce
        where ce.source_reference=j->>'evidence_ref'
          and (ce.expires_at is null or ce.expires_at>now())
      )
    ) then
      raise exception 'VERIFIED economic event requires observed external buyer, settled live payment, fulfillment, non-expired control evidence and Stripe references';
    end if;

  elsif tg_table_name='economic_actions' then
    if coalesce(j->>'execution_state','') in('AUTHORIZED','EXECUTING','SUCCEEDED')
       and coalesce(j->>'authorization_state','')<>'AUTHORIZED' then
      raise exception 'economic action cannot execute without AUTHORIZED authority state';
    end if;
    if coalesce(j->>'execution_state','') in('EXECUTING','SUCCEEDED') or j->>'executed_at' is not null then
      if coalesce(j->>'authorization_state','')<>'AUTHORIZED' then raise exception 'executed economic action requires AUTHORIZED authority state'; end if;
      if coalesce((j->>'approval_required')::boolean,false)
         and(nullif(j->>'approved_by','') is null or nullif(j->>'approved_at','') is null) then
        raise exception 'human-approved economic action requires approved_by and approved_at';
      end if;
      if nullif(j->>'actuator_id','') is null then raise exception 'economic action requires actuator_id before execution'; end if;
      select status into actuator_status from public.economic_actuators where actuator_id=(j->>'actuator_id');
      if coalesce(actuator_status,'ACTUATOR_UNAVAILABLE')<>'AVAILABLE' then raise exception 'economic action actuator is unavailable'; end if;
      if nullif(j->>'expires_at','') is not null and (j->>'expires_at')::timestamptz<=now() then raise exception 'economic action authorization is expired'; end if;
    end if;

  elsif tg_table_name='commerce_cells' and coalesce(j->>'canonical_state','')='VERIFIED' then
    if not(coalesce((j->>'verified_checkout')::boolean,false)
       and coalesce((j->>'verified_fulfillment')::boolean,false)
       and coalesce((j->>'verified_webhook')::boolean,false)
       and nullif(j->>'evidence_ref','') is not null) then
      raise exception 'VERIFIED cell requires checkout, webhook, fulfillment and evidence';
    end if;
    select count(*) into n from public.economic_outcomes o
    where o.truth_status='VERIFIED'
      and(o.offer_id=(j->>'offer_id')::uuid or o.metadata->>'cell_id'=j->>'cell_id');
    if n<1 then raise exception 'VERIFIED cell requires a VERIFIED economic outcome'; end if;

  elsif tg_table_name='commerce_cells' and coalesce(j->>'canonical_state','')='REPLICABLE' then
    select count(*),count(distinct buyer_key_hash) into n,buyers
    from public.economic_replication
    where cell_id=(j->>'cell_id')::uuid and outcome_status='VERIFIED';
    if n<2 or buyers<2 then raise exception 'REPLICABLE cell requires two independent verified transactions'; end if;
  end if;
  return new;
end;
$$;

create or replace function public.capture_economic_fulfillment_outcome()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_order_id uuid;
  v_amount numeric;
  v_reference text;
  v_event_id text;
  v_customer text;
  v_livemode boolean:=false;
  v_evidence_id uuid;
  v_outcome uuid;
begin
  if lower(coalesce(new.status,'')) not in('fulfilled','completed','complete','delivered')
     and upper(coalesce(new.canonical_state,''))<>'FULFILLED' then
    return new;
  end if;

  select re.order_id,ro.amount_nzd,ro.stripe_checkout_session_id,ro.stripe_event_id,ro.customer_email
    into v_order_id,v_amount,v_reference,v_event_id,v_customer
  from public.revenue_entitlements re
  join public.revenue_orders ro on ro.id=re.order_id
  where re.id=new.entitlement_id
  limit 1;

  if v_order_id is null or v_event_id is null or v_reference is null then return new; end if;

  select coalesce((payload->>'livemode')::boolean,false)
    into v_livemode
  from public.stripe_webhook_events
  where event_id=v_event_id
  limit 1;

  select ce.evidence_id
    into v_evidence_id
  from public.control_evidence ce
  where ce.source_reference=coalesce(new.evidence_reference,new.confirmation_reference)
    and (ce.expires_at is null or ce.expires_at>now())
  order by ce.created_at desc
  limit 1;

  if not v_livemode or v_customer is null or v_evidence_id is null then
    return new;
  end if;

  select eo.outcome_id into v_outcome
  from public.economic_outcomes eo
  where eo.outcome_type='PAID'
    and eo.external_reference=v_reference
  order by eo.observed_at desc
  limit 1;

  if v_outcome is null then return new; end if;

  update public.economic_outcomes
  set truth_status='VERIFIED',
      evidence_ids=array[v_evidence_id],
      metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
        'classification','OBSERVED',
        'scope','EXTERNAL',
        'livemode',true,
        'external_buyer',true,
        'settled_transaction',true,
        'attributed',true,
        'fulfilled',true,
        'source','capture_economic_fulfillment_outcome',
        'fulfillment_request_id',new.id
      ),
      attribution=jsonb_build_object(
        'external_buyer',true,
        'settled_transaction',true,
        'attributed',true,
        'fulfilled',true,
        'livemode',true,
        'external_reference',v_reference
      )
  where outcome_id=v_outcome;

  return new;
end;
$$;

revoke all on function public.enforce_economic_truth_and_action_guards() from public,anon,authenticated;
grant execute on function public.enforce_economic_truth_and_action_guards() to service_role;
revoke all on function public.capture_economic_fulfillment_outcome() from public,anon,authenticated;
grant execute on function public.capture_economic_fulfillment_outcome() to service_role;

commit;
