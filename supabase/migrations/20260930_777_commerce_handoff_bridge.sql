-- 777 -> existing economic substrate handoff.
-- No new commerce architecture: bind the existing 777 identity to the
-- existing silo registry, demand-signal router, and Figure Eight cell.

create or replace function public.ingest_777_commerce_handoff(p_handoff jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, figure_eight
as $$
declare
  h jsonb := coalesce(p_handoff, '{}'::jsonb);
  v_signal text := nullif(h->>'signal_id','');
  v_silo text := nullif(h->>'silo_id','');
  v_offer text := nullif(h->>'offer_id','');
  v_cell_key text := nullif(h->>'cell_id','');
  v_cell_id uuid;
  v_route jsonb;
  v_slug text;
  v_problem text;
  v_deliverable text;
begin
  if v_signal is null or v_silo is null or v_offer is null or v_cell_key is null then
    return jsonb_build_object('ok',false,'reason','HANDOFF_IDENTITY_INCOMPLETE');
  end if;

  v_slug := lower(regexp_replace(v_silo, '[^a-zA-Z0-9_-]+', '-', 'g'));
  v_problem := coalesce(h->'provenance'->>'observed_problem', 'Observed buyer signal routed by 777');
  v_deliverable := coalesce(h->'fulfillment_contract'->>'delivery_mechanism', h->'fulfillment_contract'->>'route', 'Existing approved fulfillment contract');

  insert into figure_eight.economic_cells(cell_key, silo_id, opportunity_id, state, state_evidence)
  values ('777:' || v_cell_key, v_silo, v_offer, 'SIGNAL',
          jsonb_build_object('source','777','handoff',h,'truth_status','UNVERIFIED'))
  on conflict(cell_key) do update set
    state_evidence = figure_eight.economic_cells.state_evidence || jsonb_build_object('latest_777_handoff',h),
    updated_at = now()
  returning cell_id into v_cell_id;

  if v_cell_id is null then
    select cell_id into v_cell_id from figure_eight.economic_cells where cell_key='777:' || v_cell_key;
  end if;

  insert into public.economic_silo_registry(
    silo_id, display_name, slug, source_signal_id, domain_id, template_key,
    market_region, buyer_problem, proposed_deliverable, lifecycle_stage,
    qualification_status, evidence_status, public_visibility, public_route,
    commerce_cell_id, human_approval_required, external_action_allowed,
    origin, provenance, metrics, updated_at
  ) values (
    v_silo, coalesce(h->>'offer_id', v_silo), coalesce(v_slug, lower(v_silo)),
    v_signal, v_offer, '777_COMMERCE_HANDOFF_V1', coalesce(h->>'market_region','NZ'),
    v_problem, v_deliverable, 'RESEARCH', 'READY_FOR_ELOHIM', 'UNVERIFIED',
    'HIDDEN', coalesce(h->>'checkout_url',''), v_cell_id, true, false,
    '777_COMMERCE_HANDOFF', h || jsonb_build_object('ingested_at_utc',now()),
    jsonb_build_object('impressions',0,'checkout_intents',0,'settled_payments',0,'fulfilled_orders',0,'verified_outcomes',0),
    now()
  )
  on conflict(silo_id) do update set
    source_signal_id=excluded.source_signal_id,
    domain_id=excluded.domain_id,
    buyer_problem=excluded.buyer_problem,
    proposed_deliverable=excluded.proposed_deliverable,
    lifecycle_stage=case when economic_silo_registry.lifecycle_stage in ('VERIFIED','ACTIVE')
                          then economic_silo_registry.lifecycle_stage else 'RESEARCH' end,
    qualification_status='READY_FOR_ELOHIM', evidence_status='UNVERIFIED',
    commerce_cell_id=excluded.commerce_cell_id, public_route=excluded.public_route,
    human_approval_required=true, external_action_allowed=false,
    provenance=coalesce(economic_silo_registry.provenance,'{}'::jsonb) || excluded.provenance,
    updated_at=now();

  insert into public.economic_demand_signals(
    signal_id, source, source_ref, problem_text, observed_at, silo_id,
    buyer_intent, freshness_score, evidence_score, fit_score, status,
    approval_required, raw_data
  ) values (
    v_signal, '777', '777:' || v_cell_key, v_problem, now(), v_silo,
    1, 1, 0.9, 1, 'UNROUTED', true, h
  )
  on conflict(signal_id) do update set
    source='777', source_ref=excluded.source_ref, problem_text=excluded.problem_text,
    silo_id=excluded.silo_id,
    buyer_intent=greatest(coalesce(economic_demand_signals.buyer_intent,0),1),
    freshness_score=1,
    evidence_score=greatest(coalesce(economic_demand_signals.evidence_score,0),0.9),
    fit_score=greatest(coalesce(economic_demand_signals.fit_score,0),1),
    raw_data=coalesce(economic_demand_signals.raw_data,'{}'::jsonb) || h,
    updated_at=now();

  select public.route_economic_demand(v_signal) into v_route;

  return jsonb_build_object(
    'ok',true,'signal_id',v_signal,'silo_id',v_silo,'figure_eight_cell_id',v_cell_id,
    'route',v_route,'lifecycle_state','COMMERCE_READY','truth_status','UNVERIFIED',
    'external_action','BLOCKED_UNTIL_HUMAN_APPROVAL'
  );
end;
$$;

revoke all on function public.ingest_777_commerce_handoff(jsonb) from public, anon, authenticated;
grant execute on function public.ingest_777_commerce_handoff(jsonb) to service_role;
