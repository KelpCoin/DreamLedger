-- Cash Spine Cell Factory: pricing gate, append-only transition hardening, atomic outbox preparation
-- Preserves existing figure_eight economic_cells/economic_outbox structures.

alter table figure_eight.cell_transitions
  add column if not exists prev_content_hash text;

alter table figure_eight.economic_outbox
  add column if not exists action_id uuid,
  add column if not exists idempotency_key text,
  add column if not exists operation_id text;

create unique index if not exists economic_outbox_operation_id_uq
  on figure_eight.economic_outbox(operation_id)
  where operation_id is not null;

create unique index if not exists economic_outbox_idempotency_key_uq
  on figure_eight.economic_outbox(idempotency_key)
  where idempotency_key is not null;

create index if not exists economic_outbox_pending_idx
  on figure_eight.economic_outbox(status, created_at)
  where status in ('PENDING','FAILED');

create or replace function figure_eight.prevent_cell_transition_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'FIGURE_EIGHT_APPEND_ONLY: cell_transitions cannot be updated or deleted';
end;
$$;

drop trigger if exists cell_transitions_append_only on figure_eight.cell_transitions;
create trigger cell_transitions_append_only
before update or delete on figure_eight.cell_transitions
for each row execute function figure_eight.prevent_cell_transition_mutation();

create or replace function figure_eight.transition_cell(
  p_cell_id uuid,
  p_expected_version bigint,
  p_from_state text,
  p_to_state text,
  p_evidence jsonb,
  p_actor text
)
returns jsonb
language plpgsql
as $$
declare
  c figure_eight.economic_cells%rowtype;
  edge figure_eight.transition_edges%rowtype;
  prev_hash text;
  new_hash text;
  transition_id uuid;
begin
  select * into c
  from figure_eight.economic_cells
  where cell_id=p_cell_id
  for update;

  if not found then
    return jsonb_build_object('ok',false,'reason','CELL_NOT_FOUND');
  end if;

  if c.version <> p_expected_version or c.state <> p_from_state then
    return jsonb_build_object('ok',false,'reason','CAS_MISS','state',c.state,'version',c.version);
  end if;

  select * into edge
  from figure_eight.transition_edges
  where from_state=p_from_state and to_state=p_to_state;

  if not found then
    return jsonb_build_object('ok',false,'reason','EDGE_NOT_ALLOWED');
  end if;

  if edge.guard_key='opportunity_id'
     and coalesce(p_evidence->>'opportunity_id','')='' then
    return jsonb_build_object('ok',false,'reason','MISSING_OPPORTUNITY');
  end if;

  if edge.guard_key='proposition'
     and jsonb_typeof(p_evidence->'proposition') is null then
    return jsonb_build_object('ok',false,'reason','MISSING_PROPOSITION');
  end if;

  if edge.guard_key='gauntlet_pass'
     and coalesce(p_evidence->>'verdict','') <> 'PASS' then
    return jsonb_build_object('ok',false,'reason','GAUNTLET_NOT_PASS');
  end if;

  if edge.guard_key='approval_request'
     and coalesce(p_evidence->>'approval_id','')='' then
    return jsonb_build_object('ok',false,'reason','MISSING_APPROVAL_REQUEST');
  end if;

  if edge.guard_key='approval' then
    if coalesce(p_evidence->>'status','') <> 'APPROVED'
       or lower(coalesce(p_evidence->>'approved_by','')) in ('','system','worker','automation') then
      return jsonb_build_object('ok',false,'reason','HUMAN_APPROVAL_REQUIRED');
    end if;
  end if;

  if edge.guard_key='outbox_dispatch'
     and coalesce(p_evidence->>'outbox_id','')='' then
    return jsonb_build_object('ok',false,'reason','MISSING_OUTBOX_DISPATCH');
  end if;

  if edge.guard_key='external_response'
     and coalesce(p_evidence->>'reconciliation_event_id','')='' then
    return jsonb_build_object('ok',false,'reason','MISSING_EXTERNAL_RESPONSE');
  end if;

  if edge.guard_key='settled' then
    if coalesce(p_evidence->>'mode','') <> 'EXTERNAL_INDEPENDENT_SETTLEMENT'
       or coalesce(p_evidence->>'verified','false') <> 'true' then
      return jsonb_build_object('ok',false,'reason','INDEPENDENT_SETTLEMENT_REQUIRED');
    end if;
  end if;

  if edge.guard_key='attribution'
     and coalesce(p_evidence->>'verified','false') <> 'true' then
    return jsonb_build_object('ok',false,'reason','ATTRIBUTION_UNVERIFIED');
  end if;

  if edge.guard_key='fulfillment'
     and coalesce(p_evidence->>'verified','false') <> 'true' then
    return jsonb_build_object('ok',false,'reason','FULFILLMENT_UNVERIFIED');
  end if;

  if edge.guard_key='independent_verification'
     and coalesce(p_evidence->>'provenance','') <> 'OBSERVED' then
    return jsonb_build_object('ok',false,'reason','OBSERVED_VERIFICATION_REQUIRED');
  end if;

  if edge.guard_key='rev_atom'
     and coalesce(p_evidence->>'truth_status','') <> 'VERIFIED' then
    return jsonb_build_object('ok',false,'reason','VERIFIED_REV_ATOM_REQUIRED');
  end if;

  if edge.guard_key='mechanism_candidate'
     and coalesce(p_evidence->>'mechanism_candidate_id','')='' then
    return jsonb_build_object('ok',false,'reason','MISSING_MECHANISM_CANDIDATE');
  end if;

  if edge.guard_key='mechanism_verified'
     and coalesce(p_evidence->>'status','') <> 'VERIFIED' then
    return jsonb_build_object('ok',false,'reason','MECHANISM_NOT_VERIFIED');
  end if;

  if edge.guard_key='replication_queue'
     and coalesce(p_evidence->>'replication_candidate_count',0)::int < 0 then
    return jsonb_build_object('ok',false,'reason','INVALID_REPLICATION_COUNT');
  end if;

  select content_hash into prev_hash
  from figure_eight.cell_transitions
  where cell_id=p_cell_id
  order by created_at desc, transition_id desc
  limit 1;

  transition_id := gen_random_uuid();

  new_hash := encode(digest(
    coalesce(prev_hash,'GENESIS') || '|' ||
    coalesce(c.cell_id::text,'') || '|' ||
    c.version::text || '|' || c.state || '|' || p_to_state || '|' ||
    coalesce(p_evidence::text,'') || '|' || coalesce(p_actor,''),
    'sha256'
  ),'hex');

  update figure_eight.economic_cells
     set state=p_to_state,
         state_evidence=p_evidence,
         version=version+1,
         last_transition_at=now(),
         updated_at=now()
   where cell_id=p_cell_id
     and version=p_expected_version
     and state=p_from_state;

  if not found then
    return jsonb_build_object('ok',false,'reason','CAS_LOST');
  end if;

  insert into figure_eight.cell_transitions(
    transition_id,cell_id,from_state,to_state,version_from,version_to,
    evidence,guard_snapshot,actor,content_hash,prev_content_hash
  )
  values(
    transition_id,p_cell_id,p_from_state,p_to_state,
    p_expected_version,p_expected_version+1,p_evidence,
    jsonb_build_object('guard_key',edge.guard_key,'validated_at',now()),
    coalesce(p_actor,'unknown'),new_hash,prev_hash
  );

  return jsonb_build_object(
    'ok',true,'cell_id',p_cell_id,'from_state',p_from_state,
    'to_state',p_to_state,'version',p_expected_version+1,
    'transition_id',transition_id,'content_hash',new_hash,
    'prev_content_hash',prev_hash
  );
end;
$$;

create or replace function figure_eight.create_priced_cell(
  p_opportunity_id uuid,
  p_offer_id text,
  p_sku_id text,
  p_payment_rail text,
  p_fulfillment_type text,
  p_fulfillment_route text,
  p_expected_margin numeric,
  p_action_type text,
  p_target text,
  p_verification_predicate jsonb
)
returns jsonb
language plpgsql
as $$
declare
  opp public.cube_opportunities%rowtype;
  cat public.revenue_catalog%rowtype;
  c figure_eight.economic_cells%rowtype;
  proposition jsonb;
  v_cell_key text;
  r jsonb;
begin
  select * into opp
  from public.cube_opportunities
  where opportunity_id=p_opportunity_id;

  if not found then
    return jsonb_build_object('ok',false,'reason','OPPORTUNITY_NOT_FOUND');
  end if;

  if opp.status <> 'VERIFIED' then
    return jsonb_build_object('ok',false,'reason','OPPORTUNITY_NOT_VERIFIED');
  end if;

  select * into cat
  from public.revenue_catalog
  where sku_id=p_sku_id and active=true;

  if not found then
    return jsonb_build_object('ok',false,'reason','SKU_NOT_ACTIVE','sku_id',p_sku_id);
  end if;

  if cat.price_nzd <= 0 then
    return jsonb_build_object('ok',false,'reason','PRICE_INVALID');
  end if;

  if coalesce(p_payment_rail,'')='' or coalesce(p_fulfillment_type,'')=''
     or coalesce(p_fulfillment_route,'')='' or coalesce(p_action_type,'')=''
     or coalesce(p_target,'')='' or p_verification_predicate is null
     or coalesce(p_offer_id,'')='' then
    return jsonb_build_object('ok',false,'reason','PROPOSITION_BLOCKED','missing_fields',jsonb_build_array(
      case when coalesce(p_offer_id,'')='' then 'offer_id' end,
      case when coalesce(p_sku_id,'')='' then 'sku_id' end,
      case when coalesce(p_payment_rail,'')='' then 'payment_rail' end,
      case when coalesce(p_fulfillment_type,'')='' then 'fulfillment_type' end,
      case when coalesce(p_fulfillment_route,'')='' then 'fulfillment_route' end,
      case when coalesce(p_action_type,'')='' then 'action_type' end,
      case when coalesce(p_target,'')='' then 'target' end
    ));
  end if;

  if upper(cat.fulfillment_type) <> upper(p_fulfillment_type) then
    return jsonb_build_object('ok',false,'reason','FULFILLMENT_TYPE_MISMATCH');
  end if;

  if p_payment_rail='stripe' and (cat.stripe_price_id is null or cat.stripe_payment_link is null) then
    return jsonb_build_object('ok',false,'reason','PAYMENT_RAIL_NOT_READY');
  end if;

  if p_expected_margin <= 0 then
    return jsonb_build_object('ok',false,'reason','MARGIN_NON_POSITIVE');
  end if;

  if cat.currency <> 'NZD' then
    return jsonb_build_object('ok',false,'reason','CURRENCY_NOT_NZD');
  end if;

  if cat.price_nzd <> round((cat.price_nzd::numeric),0)::integer then
    return jsonb_build_object('ok',false,'reason','CATALOG_PRICE_INVALID');
  end if;

  proposition := jsonb_build_object(
    'offer_id',p_offer_id,
    'sku_id',p_sku_id,
    'price_nzd',cat.price_nzd,
    'currency','NZD',
    'payment_rail',p_payment_rail,
    'fulfillment_type',p_fulfillment_type,
    'fulfillment_route',p_fulfillment_route,
    'expected_margin',p_expected_margin,
    'action_type',p_action_type,
    'target',p_target,
    'verification_predicate',p_verification_predicate,
    'stripe_price_id',cat.stripe_price_id,
    'stripe_payment_link',cat.stripe_payment_link
  );

  v_cell_key := 'opp:'||p_opportunity_id::text||':sku:'||p_sku_id;

  insert into figure_eight.economic_cells(
    cell_key,silo_id,signal_fossil_id,opportunity_id,state,state_evidence,correlation_key
  )
  values(
    v_cell_key,opp.silo_id,null,p_opportunity_id::text,'SIGNAL',
    jsonb_build_object('opportunity_id',p_opportunity_id,'proposition',proposition),
    'opp:'||p_opportunity_id::text
  )
  on conflict(cell_key) do nothing;

  select * into c from figure_eight.economic_cells where cell_key=v_cell_key;

  r := figure_eight.transition_cell(
    c.cell_id,c.version,'SIGNAL','OPPORTUNITY',
    jsonb_build_object('opportunity_id',p_opportunity_id,'source',opp.source),
    'cell-factory'
  );

  if coalesce((r->>'ok')::boolean,false) is not true then
    return r || jsonb_build_object('cell_id',c.cell_id);
  end if;

  select * into c from figure_eight.economic_cells where cell_id=c.cell_id;

  r := figure_eight.transition_cell(
    c.cell_id,c.version,'OPPORTUNITY','PROPOSITION',
    jsonb_build_object(
      'opportunity_id',p_opportunity_id,
      'proposition',proposition
    ),
    'cell-factory'
  );

  return r || jsonb_build_object('cell_id',c.cell_id,'cell_key',v_cell_key,'proposition',proposition);
end;
$$;

create or replace function figure_eight.prepare_dispatch_with_outbox(
  p_cell_id uuid,
  p_expected_version bigint,
  p_action_id uuid,
  p_action_type text,
  p_action_payload jsonb,
  p_dedup_key text,
  p_idempotency_key text,
  p_operation_id text,
  p_actor text
)
returns jsonb
language plpgsql
as $$
declare
  c figure_eight.economic_cells%rowtype;
  r jsonb;
  o figure_eight.economic_outbox%rowtype;
begin
  select * into c
  from figure_eight.economic_cells
  where cell_id=p_cell_id
  for update;

  if not found then
    return jsonb_build_object('ok',false,'reason','CELL_NOT_FOUND');
  end if;

  if c.version <> p_expected_version or c.state <> 'AUTHORIZED' then
    return jsonb_build_object('ok',false,'reason','CAS_MISS','state',c.state,'version',c.version);
  end if;

  if p_action_id is null or coalesce(p_action_type,'')='' or p_action_payload is null
     or coalesce(p_dedup_key,'')='' or coalesce(p_idempotency_key,'')=''
     or coalesce(p_operation_id,'')='' then
    return jsonb_build_object('ok',false,'reason','OUTBOX_IDENTITY_REQUIRED');
  end if;

  if exists(select 1 from figure_eight.economic_outbox where operation_id=p_operation_id)
     or exists(select 1 from figure_eight.economic_outbox where idempotency_key=p_idempotency_key) then
    return jsonb_build_object('ok',false,'reason','DUPLICATE_OPERATION');
  end if;

  r := figure_eight.transition_cell(
    p_cell_id,p_expected_version,'AUTHORIZED','ACTION_READY',
    jsonb_build_object(
      'action_id',p_action_id,
      'action_type',p_action_type,
      'idempotency_key',p_idempotency_key,
      'operation_id',p_operation_id
    ),
    coalesce(p_actor,'cell-dispatch')
  );

  if coalesce((r->>'ok')::boolean,false) is not true then
    return r;
  end if;

  insert into figure_eight.economic_outbox(
    cell_id,action_type,action_payload,dedup_key,status,
    action_id,idempotency_key,operation_id
  )
  values(
    p_cell_id,p_action_type,p_action_payload,p_dedup_key,'PENDING',
    p_action_id,p_idempotency_key,p_operation_id
  )
  returning * into o;

  return jsonb_build_object(
    'ok',true,
    'cell_id',p_cell_id,
    'outbox_id',o.outbox_id,
    'operation_id',o.operation_id,
    'idempotency_key',o.idempotency_key,
    'state','ACTION_READY',
    'transition',r
  );
end;
$$;
