begin;

create or replace function public.enforce_economic_truth_and_action_guards()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  verified_evidence_count integer;
  replication_count integer;
  independent_buyer_count integer;
  actuator_status text;
begin
  if tg_table_name = 'economic_outcomes' then
    if new.truth_status = 'VERIFIED' then
      if not (coalesce((new.attribution->>'external_buyer')::boolean,false)
        and coalesce((new.attribution->>'settled_transaction')::boolean,false)
        and coalesce((new.attribution->>'attributed')::boolean,false)
        and coalesce(cardinality(new.evidence_ids),0) >= 1
        and coalesce((new.attribution->>'fulfilled')::boolean,false)) then
        raise exception 'VERIFIED outcome requires external buyer, settled transaction, attribution, fulfillment and evidence';
      end if;
      if new.external_reference is null or btrim(new.external_reference)='' then
        raise exception 'VERIFIED outcome requires external_reference';
      end if;
    end if;
  elsif tg_table_name = 'economic_events' then
    if new.verification_status = 'VERIFIED' then
      if not (new.scope='EXTERNAL' and new.observation_mode='OBSERVED' and new.buyer_action_verified
        and new.payment_settled and new.fulfilment_verified and new.evidence_verified
        and new.stripe_payment_intent is not null and new.stripe_checkout_session is not null
        and new.evidence_ref is not null) then
        raise exception 'VERIFIED economic event requires observed external buyer, settled payment, fulfillment, evidence and Stripe references';
      end if;
    end if;
  elsif tg_table_name = 'economic_actions' then
    if new.execution_state in ('AUTHORIZED','EXECUTING','SUCCEEDED') and new.authorization_state <> 'AUTHORIZED' then
      raise exception 'economic action cannot execute without AUTHORIZED authority state';
    end if;
    if new.execution_state in ('EXECUTING','SUCCEEDED') or new.executed_at is not null then
      if new.authorization_state <> 'AUTHORIZED' then raise exception 'executed economic action requires AUTHORIZED authority state'; end if;
      if new.approval_required and (new.approved_by is null or new.approved_at is null) then raise exception 'human-approved economic action requires approved_by and approved_at'; end if;
      if new.actuator_id is null then raise exception 'economic action requires actuator_id before execution'; end if;
      select status into actuator_status from public.economic_actuators where actuator_id=new.actuator_id;
      if coalesce(actuator_status,'ACTUATOR_UNAVAILABLE') <> 'AVAILABLE' then raise exception 'economic action actuator is unavailable'; end if;
      if new.expires_at is not null and new.expires_at <= now() then raise exception 'economic action authorization is expired'; end if;
    end if;
  elsif tg_table_name = 'commerce_cells' then
    if new.canonical_state='VERIFIED' then
      if not (new.verified_checkout and new.verified_fulfillment and new.verified_webhook and new.evidence_ref is not null) then raise exception 'VERIFIED cell requires checkout, webhook, fulfillment and evidence'; end if;
      select count(*) into verified_evidence_count from public.economic_outcomes o
      where o.truth_status='VERIFIED' and (o.offer_id = new.offer_id or o.metadata->>'cell_id' = new.cell_id::text);
      if verified_evidence_count < 1 then raise exception 'VERIFIED cell requires a VERIFIED economic outcome'; end if;
    end if;
    if new.canonical_state='REPLICABLE' then
      select count(*), count(distinct buyer_key_hash) into replication_count, independent_buyer_count
      from public.economic_replication where cell_id=new.cell_id and outcome_status='VERIFIED';
      if replication_count < 2 or independent_buyer_count < 2 then raise exception 'REPLICABLE cell requires two independent verified transactions'; end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_economic_truth_guards_outcomes on public.economic_outcomes;
create trigger trg_economic_truth_guards_outcomes before insert or update on public.economic_outcomes for each row execute function public.enforce_economic_truth_and_action_guards();
drop trigger if exists trg_economic_truth_guards_events on public.economic_events;
create trigger trg_economic_truth_guards_events before insert or update on public.economic_events for each row execute function public.enforce_economic_truth_and_action_guards();
drop trigger if exists trg_economic_truth_guards_actions on public.economic_actions;
create trigger trg_economic_truth_guards_actions before insert or update on public.economic_actions for each row execute function public.enforce_economic_truth_and_action_guards();
drop trigger if exists trg_economic_truth_guards_cells on public.commerce_cells;
create trigger trg_economic_truth_guards_cells before insert or update on public.commerce_cells for each row execute function public.enforce_economic_truth_and_action_guards();

drop view if exists public.economic_control_report;
create view public.economic_control_report as
with verified as (
  select count(*) filter (where truth_status='VERIFIED')::bigint verified_events,
    coalesce(sum(amount_nzd) filter (where truth_status='VERIFIED'),0)::numeric verified_revenue_nzd,
    count(distinct attribution->>'buyer_key') filter (where truth_status='VERIFIED' and coalesce(attribution->>'buyer_key','')<>'')::bigint independent_buyers,
    max(observed_at) filter (where truth_status='VERIFIED') last_verified_at
  from public.economic_outcomes
), cells as (
  select count(*) filter (where canonical_state='READY')::bigint ready_cells,
    count(*) filter (where canonical_state='ACTIVE')::bigint active_cells,
    count(*) filter (where canonical_state='BLOCKED')::bigint blocked_cells,
    count(*) filter (where canonical_state='QUARANTINED')::bigint quarantined_cells,
    count(*) filter (where canonical_state='REPLICABLE')::bigint replicable_cells
  from public.commerce_cells
), human as (
  select count(*)::bigint interventions from public.economic_human_interventions
), act as (
  select count(*) filter (where status='AVAILABLE')::bigint available,
    count(*) filter (where status='ACTUATOR_UNAVAILABLE')::bigint unavailable
  from public.economic_actuators
)
select 'ECONOMIC_CONTROL_REPORT_V1'::text report_schema,
  case when verified.verified_events > 0 then 'VERIFIED' else 'UNVERIFIED' end current_state,
  verified.verified_revenue_nzd verified_revenue, verified.verified_events verified_payments,
  verified.independent_buyers, cells.active_cells active_cell_count, cells.ready_cells, cells.blocked_cells,
  cells.quarantined_cells, cells.replicable_cells, verified.last_verified_at,
  act.available actuators_available, act.unavailable actuators_unavailable, human.interventions human_interventions,
  case when human.interventions=0 then null else round(verified.verified_events::numeric/human.interventions,4) end verified_events_per_human_intervention,
  (select count(*) from public.economic_actions where execution_state in ('PREPARED','AUTHORITY_REQUIRED','AUTHORIZED'))::bigint pending_actions,
  (select count(*) from public.economic_actions where execution_state='SUCCEEDED')::bigint succeeded_actions,
  (select count(*) from public.economic_actions where execution_state='ACTUATOR_UNAVAILABLE')::bigint actuator_blocked_actions
from verified cross join cells cross join human cross join act;

commit;