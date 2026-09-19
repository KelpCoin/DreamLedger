-- BECK Economic Operator v1
-- Reuses existing jobs, offers, commerce_cells, economic_actions,
-- prospecting_candidates, revenue_orders, fulfillment_requests and evidence.
-- No new queue/table. Model proposes; deterministic controller decides.

create or replace function public.beck_economic_snapshot(p_objective_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_paid_count integer := 0;
  v_revenue_nzd numeric := 0;
  v_pending_fulfillment integer := 0;
  v_live_offer jsonb := '{}'::jsonb;
  v_pending_distribution integer := 0;
  v_approved_unsent integer := 0;
  v_prospects integer := 0;
  v_next text := 'DISCOVER_DEMAND';
  v_objective public.jobs;
begin
  select * into v_objective
  from public.jobs
  where id=p_objective_id and type='beck_objective';

  if not found then
    return jsonb_build_object('status','OBJECTIVE_NOT_FOUND');
  end if;

  select count(*), coalesce(sum(amount_nzd),0)
    into v_paid_count,v_revenue_nzd
  from public.revenue_orders
  where lower(status)='paid';

  select count(*)
    into v_pending_fulfillment
  from public.fulfillment_requests f
  where lower(coalesce(f.status,'')) not in ('fulfilled','completed','delivered')
    and exists (
      select 1
      from public.revenue_orders r
      where lower(r.status)='paid'
        and r.sku_id=f.sku_id
    );

  select jsonb_build_object(
    'offer_id',o.id,
    'title',o.title,
    'sku',c.sku,
    'price_nzd',c.price_cents/100.0,
    'checkout_url',c.checkout_url,
    'state',c.state,
    'acquisition_state',c.acquisition_state,
    'approval_required',c.approval_required,
    'verified_checkout',c.verified_checkout,
    'verified_fulfillment',c.verified_fulfillment,
    'verified_webhook',c.verified_webhook
  )
  into v_live_offer
  from public.offers o
  join public.commerce_cells c on c.offer_id=o.id
  where o.lifecycle_status='live'
    and o.visibility in ('public','featured')
    and c.state='SELLABLE'
    and c.verified_checkout=true
    and c.verified_fulfillment=true
    and c.verified_webhook=true
    and (
      v_objective.payload->>'sku_id' is null
      or c.sku=v_objective.payload->>'sku_id'
      or c.product_id=v_objective.payload->>'product_id'
    )
  order by o.updated_at desc
  limit 1;

  select count(*)
    into v_pending_distribution
  from public.economic_actions a
  where a.approval_required=true
    and a.approved_at is null
    and a.executed_at is null
    and a.action_type in ('OUTREACH_PREPARED','DISTRIBUTION_PREPARED')
    and (v_live_offer->>'offer_id' is null or a.offer_id=(v_live_offer->>'offer_id')::uuid);

  select count(*)
    into v_approved_unsent
  from public.economic_actions a
  where a.approval_required=true
    and a.approved_at is not null
    and a.executed_at is null
    and a.action_type in ('OUTREACH_APPROVED','DISTRIBUTION_APPROVED');

  select count(*)
    into v_prospects
  from public.prospecting_candidates p
  where p.approval_status='pending_human_review'
    and (
      v_live_offer->>'title' is null
      or p.target_offer ilike '%' || (v_live_offer->>'title') || '%'
      or p.target_offer ilike '%' || coalesce(v_live_offer->>'sku','') || '%'
    );

  if v_paid_count > 0 and v_pending_fulfillment > 0 then
    v_next := 'FULFIL_ORDER';
  elsif v_paid_count > 0 then
    v_next := 'VERIFY_PAYMENT';
  elsif v_live_offer = '{}'::jsonb then
    v_next := 'BUILD_OFFER';
  elsif v_approved_unsent > 0 then
    v_next := 'AWAITING_APPROVED_DISTRIBUTION';
  elsif v_pending_distribution > 0 then
    v_next := 'AWAITING_HUMAN_APPROVAL';
  elsif v_prospects > 0 then
    v_next := 'PREPARE_DISTRIBUTION';
  else
    v_next := 'DISCOVER_DEMAND';
  end if;

  return jsonb_build_object(
    'objective_id',p_objective_id,
    'verified_revenue_nzd',v_revenue_nzd,
    'verified_payment_count',v_paid_count,
    'pending_fulfillment_count',v_pending_fulfillment,
    'live_offer',v_live_offer,
    'pending_distribution_count',v_pending_distribution,
    'approved_unsent_distribution_count',v_approved_unsent,
    'pending_prospect_count',v_prospects,
    'next_action',v_next,
    'economic_truth',case when v_paid_count>0 then 'REVENUE_DETECTED' else 'NO_REVENUE' end
  );
end $$;

create or replace function public.evaluate_economic_gate(
  p_objective_id uuid,
  p_proposed_action text default null,
  p_expected_cost_nzd numeric default 0
)
returns text
language plpgsql
security definer
set search_path=''
as $$
declare
  s jsonb;
  v_price numeric := 0;
  v_cost numeric := greatest(coalesce(p_expected_cost_nzd,0),0);
  v_margin numeric;
begin
  s := public.beck_economic_snapshot(p_objective_id);

  update public.jobs
  set last_payment_check_at=pg_catalog.now(),
      economic_gate_status=case
        when (s->>'verified_payment_count')::integer > 0 then 'REVENUE_DETECTED'
        else 'NO_REVENUE'
      end
  where id=p_objective_id and type='beck_objective';

  if p_proposed_action in ('SEND_OUTREACH','SEND_FOLLOWUP','SPEND_MONEY','CREATE_CHARGE') then
    return 'APPROVAL_REQUIRED';
  end if;

  if v_cost > 0 then
    v_price := coalesce((s->'live_offer'->>'price_nzd')::numeric,0);
    if v_price <= 0 then return 'UNIT_ECONOMICS_UNKNOWN'; end if;
    v_margin := (v_price-v_cost)/v_price;
    if v_margin < 0.40 then return 'MARGIN_BELOW_FLOOR'; end if;
  end if;

  if (s->>'verified_payment_count')::integer > 0
     and p_proposed_action in ('VERIFY_PAYMENT','RECONCILE_REVENUE','FULFIL_ORDER','LEARN_FROM_OUTCOME') then
    return 'REVENUE_DETECTED';
  end if;

  if p_proposed_action in (
    'INSPECT_COMMERCIAL_PATH','ANALYZE_ECONOMICS','VERIFY_CHECKOUT',
    'DISCOVER_DEMAND','PREPARE_DISTRIBUTION','PREPARE_OUTREACH',
    'VERIFY_PAYMENT','RECONCILE_REVENUE','FULFIL_ORDER','LEARN_FROM_OUTCOME'
  ) then
    return 'REVENUE_PATH_CLEAR';
  end if;

  return 'NOT_ON_REVENUE_PATH';
end $$;

create or replace function public.beck_authorize_action(
  p_objective_id uuid,
  p_action_id text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  o public.jobs;
  gate text;
  snap jsonb;
begin
  select * into o
  from public.jobs
  where id=p_objective_id and type='beck_objective';

  if not found then
    return jsonb_build_object('allowed',false,'reason','OBJECTIVE_NOT_FOUND');
  end if;

  if o.beck_lifecycle <> 'active' then
    return jsonb_build_object('allowed',false,'reason','OBJECTIVE_LIFECYCLE_'||upper(o.beck_lifecycle));
  end if;

  snap := public.beck_economic_snapshot(p_objective_id);
  gate := public.evaluate_economic_gate(p_objective_id,p_action_id,0);

  if p_action_id in (
    'LOOP_001_OBSERVE','LOOP_002_NORMALIZE','LOOP_003_DEMAND_SCAN','LOOP_004_SYNTHESIZE',
    'INSPECT_COMMERCIAL_PATH','ANALYZE_ECONOMICS','VERIFY_CHECKOUT',
    'DISCOVER_DEMAND','PREPARE_DISTRIBUTION','PREPARE_OUTREACH',
    'VERIFY_PAYMENT','RECONCILE_REVENUE','FULFIL_ORDER','LEARN_FROM_OUTCOME'
  ) and gate in ('REVENUE_PATH_CLEAR','REVENUE_DETECTED') then
    return jsonb_build_object('allowed',true,'action_id',p_action_id,'economic_gate',gate,'snapshot',snap,'external_effects',false);
  end if;

  if p_action_id in ('SEND_OUTREACH','SEND_FOLLOWUP','SPEND_MONEY','CREATE_CHARGE') then
    return jsonb_build_object('allowed',false,'reason','APPROVAL_REQUIRED','economic_gate',gate,'snapshot',snap);
  end if;

  return jsonb_build_object('allowed',false,'reason','ECONOMIC_GATE_'||gate,'economic_gate',gate,'snapshot',snap);
end $$;

revoke all on function public.beck_economic_snapshot(uuid) from public;
revoke all on function public.evaluate_economic_gate(uuid,text,numeric) from public;
revoke all on function public.beck_authorize_action(uuid,text) from public;
grant execute on function public.beck_economic_snapshot(uuid) to service_role;
grant execute on function public.evaluate_economic_gate(uuid,text,numeric) to service_role;
grant execute on function public.beck_authorize_action(uuid,text) to service_role;
