-- Agent Bridge paid-call quota enforcement.
-- Reuses the canonical control_bridge_notes event log; no second ledger/table.
-- Every billable request reserves exactly one unit under a per-key advisory lock.
-- Apply only after the Supabase project is healthy; callers fail closed when RPC is unavailable.

create or replace function public.reserve_agent_toll_call(
  p_key_id text,
  p_reference text,
  p_scope text,
  p_idempotency_key text,
  p_request_hash text,
  p_call_limit integer,
  p_correlation_id text,
  p_route text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event_id text;
  v_existing jsonb;
  v_used integer;
  v_limit integer;
  v_remaining integer;
  v_body jsonb;
begin
  if coalesce(trim(p_key_id), '') = '' or coalesce(trim(p_idempotency_key), '') = '' then
    return jsonb_build_object('status','INVALID_REQUEST');
  end if;
  v_limit := greatest(1, least(coalesce(p_call_limit, 1), 1000000));
  v_event_id := 'TOLL-USAGE-' || regexp_replace(p_key_id, '[^A-Za-z0-9_-]', '', 'g')
    || '-' || md5(p_idempotency_key);

  perform pg_advisory_xact_lock(hashtextextended(p_key_id, 0));

  select body::jsonb into v_existing
  from public.control_bridge_notes
  where note_type = 'STRUCTURED_EVENT' and event_id = v_event_id
  limit 1;

  if v_existing is not null then
    if coalesce(v_existing->>'request_hash','') <> coalesce(p_request_hash,'') then
      return jsonb_build_object('status','IDEMPOTENCY_CONFLICT');
    end if;
    if v_existing->>'result_status' is not null then
      return jsonb_build_object(
        'status','REPLAY',
        'http_status',coalesce((v_existing->>'http_status')::integer,200),
        'response_body',coalesce(v_existing->'response_body','{}'::jsonb),
        'remaining',coalesce((v_existing->>'remaining')::integer,0),
        'event_id',v_event_id
      );
    end if;
    return jsonb_build_object('status','IN_PROGRESS','event_id',v_event_id);
  end if;

  select count(*)::integer into v_used
  from public.control_bridge_notes
  where note_type = 'STRUCTURED_EVENT'
    and subject = 'TOLL_USAGE:' || p_key_id
    and source_system = 'agent-toll-road';

  if v_used >= v_limit then
    return jsonb_build_object('status','EXHAUSTED','limit',v_limit,'used',v_used,'remaining',0);
  end if;

  v_remaining := v_limit - v_used - 1;
  v_body := jsonb_build_object(
    'event_id',v_event_id,
    'correlation_id',coalesce(nullif(p_correlation_id,''),v_event_id),
    'schema','dreamledger/agent-toll-usage/v1',
    'status','RESERVED',
    'key_id',p_key_id,
    'payment_reference',left(coalesce(p_reference,''),256),
    'scope',left(coalesce(p_scope,''),80),
    'route',left(coalesce(p_route,''),240),
    'idempotency_key_hash',md5(p_idempotency_key),
    'request_hash',coalesce(p_request_hash,''),
    'call_limit',v_limit,
    'used_before',v_used,
    'remaining',v_remaining,
    'reserved_at',clock_timestamp()
  );

  insert into public.control_bridge_notes(
    from_agent,to_agent,note_type,subject,body,requires_response,
    correlation_id,lane,priority,silo_id,source_system
  ) values (
    'system','toll-meter','STRUCTURED_EVENT','TOLL_USAGE:' || p_key_id,
    v_body::text,false,coalesce(nullif(p_correlation_id,''),v_event_id),
    'payment',70,'SILO_AGENT_BRIDGE','agent-toll-road'
  );

  return jsonb_build_object('status','RESERVED','event_id',v_event_id,'remaining',v_remaining,'used',v_used+1,'limit',v_limit);
end;
$$;

create or replace function public.complete_agent_toll_call(
  p_event_id text,
  p_http_status integer,
  p_response_body jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_body jsonb;
begin
  select body::jsonb into v_body
  from public.control_bridge_notes
  where note_type = 'STRUCTURED_EVENT' and event_id = p_event_id
  for update;

  if v_body is null then
    return jsonb_build_object('status','NOT_FOUND');
  end if;

  if v_body->>'result_status' is not null then
    return jsonb_build_object('status','ALREADY_COMPLETED');
  end if;

  v_body := v_body || jsonb_build_object(
    'result_status','COMPLETED',
    'http_status',greatest(100,least(coalesce(p_http_status,200),599)),
    'response_body',coalesce(p_response_body,'{}'::jsonb),
    'completed_at',clock_timestamp()
  );

  update public.control_bridge_notes
  set body = v_body::text
  where note_type = 'STRUCTURED_EVENT' and event_id = p_event_id;

  -- A successful paid response proves the buyer can use the issued key.
  -- Upgrade existing canonical fulfillment/reconciliation records; do not create a second ledger.
  if p_http_status between 200 and 299 and coalesce(v_body->>'payment_reference','')<>'' then
    begin
      update public.fulfillment_requests fr
      set canonical_state='FULFILLED_VERIFIED',
          evidence_status='VERIFIED',
          evidence_reference='agent-toll-call:'||p_event_id,
          payload=coalesce(fr.payload,'{}'::jsonb)||jsonb_build_object(
            'api_access_delivery',coalesce(fr.payload->'api_access_delivery','{}'::jsonb)||
              jsonb_build_object('first_successful_api_call_event_id',p_event_id,'verified_at',clock_timestamp())
          ),
          updated_at=clock_timestamp()
      where fr.status='fulfilled'
        and fr.fulfillment_reference like 'agent-bridge-api-key:%'
        and fr.entitlement_id in (
          select e.id from public.revenue_entitlements e
          join public.revenue_orders o on o.id=e.order_id
          where o.stripe_checkout_session_id=v_body->>'payment_reference'
            and o.status='paid' and o.sku_id=e.sku_id
        );

      update public.economic_events ee
      set fulfilment_verified=true,evidence_verified=true,
          evidence_ref='agent-toll-call:'||p_event_id,updated_at=clock_timestamp()
      where ee.stripe_checkout_session=v_body->>'payment_reference'
        and ee.sku_id in (
          select o.sku_id from public.revenue_orders o
          where o.stripe_checkout_session_id=v_body->>'payment_reference' and o.status='paid'
        );

      update public.control_reconciliations cr
      set status='FULFILLED_VERIFIED',fulfillment_verified=true,
          checked_at=clock_timestamp(),checked_by='agent-toll-meter',
          notes='First successful authenticated API operation observed; delivery evidence verified.'
      where cr.order_reference::text in (
          select o.id::text from public.revenue_orders o
          where o.stripe_checkout_session_id=v_body->>'payment_reference' and o.status='paid'
        );
    exception when others then
      v_body := v_body || jsonb_build_object(
        'fulfillment_verification_status','PENDING',
        'fulfillment_verification_sqlstate',SQLSTATE
      );
      update public.control_bridge_notes
      set body=v_body::text
      where note_type='STRUCTURED_EVENT' and event_id=p_event_id;
    end;
  end if;

  return jsonb_build_object('status','COMPLETED','event_id',p_event_id);
end;
$$;

revoke all on function public.reserve_agent_toll_call(text,text,text,text,text,integer,text,text) from public, anon, authenticated;
revoke all on function public.complete_agent_toll_call(text,integer,jsonb) from public, anon, authenticated;
grant execute on function public.reserve_agent_toll_call(text,text,text,text,text,integer,text,text) to service_role;
grant execute on function public.complete_agent_toll_call(text,integer,jsonb) to service_role;

-- Canonical commerce registration for Toll Road SKUs.
-- Existing revenue_orders/revenue_entitlements/fulfillment_requests remain authoritative.
insert into public.skus (id, silo_id, status) values
  ('TOLL-PROBE-1','commerce','active'),
  ('DECISION-CHECK-100','commerce','active'),
  ('EVIDENCE-CHECK-100','commerce','active'),
  ('AGENT-BRIDGE-STARTER-500','commerce','active'),
  ('MICRO-EVENT-INGEST-200','commerce','active'),
  ('ROUTE-PASS-30D-5000','commerce','active'),
  ('TOLL-NEXUS-25','commerce','active')
on conflict (id) do update set silo_id=excluded.silo_id,status='active';

insert into public.revenue_catalog
  (sku_id,name,lane,description,price_nzd,active,fulfillment_type,currency)
values
  ('TOLL-PROBE-1','Agent Bridge Toll Probe','agent_bridge','One bounded live API readiness probe; 30-day entitlement.',1,true,'agent_bridge_api_access','NZD'),
  ('DECISION-CHECK-100','Agent Bridge Decision Check','agent_bridge','100 bounded Gauntlet decision evaluations; 30-day entitlement.',19,true,'agent_bridge_api_access','NZD'),
  ('EVIDENCE-CHECK-100','Agent Bridge Evidence Check','agent_bridge','100 bounded evidence classification evaluations; 30-day entitlement.',9,true,'agent_bridge_api_access','NZD'),
  ('AGENT-BRIDGE-STARTER-500','Agent Bridge Starter','agent_bridge','500 bounded structured Agent Bridge event ingests; 30-day entitlement.',5,true,'agent_bridge_api_access','NZD'),
  ('MICRO-EVENT-INGEST-200','Agent Bridge Micro Event Ingest','agent_bridge','200 bounded structured Agent Bridge event ingests; 30-day entitlement.',2,true,'agent_bridge_api_access','NZD'),
  ('ROUTE-PASS-30D-5000','Agent Bridge Shared Route Pass','agent_bridge','5,000 billable operations shared across published routes; 30-day entitlement.',9,true,'agent_bridge_api_access','NZD'),
  ('TOLL-NEXUS-25','Agent Bridge Toll Nexus','agent_bridge','25 bounded Truth, Gauntlet and Agent Bridge evaluation runs; 30-day entitlement.',19,true,'agent_bridge_api_access','NZD')
on conflict (sku_id) do update set
  name=excluded.name,lane=excluded.lane,description=excluded.description,
  price_nzd=excluded.price_nzd,active=true,fulfillment_type=excluded.fulfillment_type,
  currency=excluded.currency,updated_at=now();

create or replace function public.get_agent_toll_entitlement(
  p_session_id text,
  p_sku_id text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $
declare
  v_order record;
  v_entitlement record;
  v_fulfillment record;
begin
  select id,sku_id,status,stripe_event_id,stripe_payment_intent_id
    into v_order
  from public.revenue_orders
  where stripe_checkout_session_id=p_session_id
  limit 1;

  if not found then
    return jsonb_build_object('status','PENDING','reason','canonical_order_not_observed');
  end if;
  if v_order.status <> 'paid' or v_order.sku_id <> p_sku_id then
    return jsonb_build_object('status','CONTRADICTED','reason','canonical_order_sku_or_payment_mismatch');
  end if;

  select id,sku_id,fulfillment_key,status
    into v_entitlement
  from public.revenue_entitlements
  where order_id=v_order.id and sku_id=p_sku_id
  limit 1;
  if not found then
    return jsonb_build_object('status','PENDING','reason','canonical_entitlement_not_observed');
  end if;
  if v_entitlement.status not in ('ready','fulfilled') then
    return jsonb_build_object('status','PENDING','reason','canonical_entitlement_not_ready');
  end if;

  select id,status
    into v_fulfillment
  from public.fulfillment_requests
  where entitlement_id=v_entitlement.id and sku_id=p_sku_id
  limit 1;
  if not found then
    return jsonb_build_object('status','PENDING','reason','canonical_fulfillment_request_not_observed');
  end if;

  return jsonb_build_object(
    'status','READY','sku_id',v_order.sku_id,'order_id',v_order.id,
    'stripe_event_id',v_order.stripe_event_id,
    'stripe_payment_intent_id',v_order.stripe_payment_intent_id,
    'entitlement_id',v_entitlement.id,'fulfillment_key',v_entitlement.fulfillment_key,
    'entitlement_status',v_entitlement.status,
    'fulfillment_request_id',v_fulfillment.id,'fulfillment_status',v_fulfillment.status
  );
end;
$;

create or replace function public.complete_agent_toll_fulfillment(
  p_session_id text,
  p_sku_id text,
  p_fulfillment_key text,
  p_key_id text,
  p_key_digest text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order_id uuid;
  v_stripe_event_id text;
  v_entitlement_id uuid;
  v_fulfillment_id uuid;
  v_fulfillment_status text;
  v_fulfillment_reference text;
begin
  if coalesce(trim(p_session_id),'')='' or coalesce(trim(p_sku_id),'')='' or
     coalesce(trim(p_fulfillment_key),'')='' or coalesce(trim(p_key_id),'')='' or
     coalesce(p_key_digest,'') !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('status','INVALID_REQUEST');
  end if;

  select o.id,o.stripe_event_id,e.id,fr.id,fr.status,fr.fulfillment_reference
    into v_order_id,v_stripe_event_id,v_entitlement_id,v_fulfillment_id,v_fulfillment_status,v_fulfillment_reference
  from public.revenue_orders o
  join public.revenue_entitlements e on e.order_id=o.id
  join public.fulfillment_requests fr on fr.entitlement_id=e.id
  where o.stripe_checkout_session_id=p_session_id
    and o.status='paid' and o.sku_id=p_sku_id
    and e.sku_id=p_sku_id and e.fulfillment_key=p_fulfillment_key
    and fr.sku_id=p_sku_id
  limit 1
  for update of e,fr;

  if not found then
    return jsonb_build_object('status','PENDING_CANONICAL_ENTITLEMENT');
  end if;

  if v_fulfillment_status='fulfilled' then
    if v_fulfillment_reference='agent-bridge-api-key:'||p_key_id then
      return jsonb_build_object('status','ALREADY_FULFILLED','fulfillment_request_id',v_fulfillment_id);
    end if;
    return jsonb_build_object('status','FULFILLMENT_CONFLICT');
  end if;
  if v_fulfillment_status not in ('queued','processing') then
    return jsonb_build_object('status','FULFILLMENT_NOT_READY','fulfillment_status',v_fulfillment_status);
  end if;

  update public.fulfillment_requests
  set status='fulfilled',
      canonical_state='FULFILLED',
      fulfillment_reference='agent-bridge-api-key:'||p_key_id,
      evidence_reference='sha256:'||p_key_digest,
      evidence_status='UNVERIFIED',
      payload=coalesce(payload,'{}'::jsonb)||jsonb_build_object(
        'api_access_delivery',jsonb_build_object(
          'key_id',p_key_id,'key_sha256',p_key_digest,
          'issued_at',clock_timestamp(),'first_successful_api_call_verified',false
        )
      ),
      updated_at=clock_timestamp()
  where id=v_fulfillment_id;

  update public.revenue_entitlements
  set status='fulfilled',redeemed_at=coalesce(redeemed_at,clock_timestamp())
  where id=v_entitlement_id;

  update public.economic_events
  set fulfilment_verified=true,evidence_verified=false,
      evidence_ref='api-key-issued:'||p_key_id,updated_at=clock_timestamp()
  where stripe_checkout_session=p_session_id and sku_id=p_sku_id;

  update public.control_reconciliations
  set status='FULFILLED_UNVERIFIED',fulfillment_verified=true,
      checked_at=clock_timestamp(),checked_by='agent-toll-fulfillment',
      notes='Signed API key issued; first successful authenticated API operation is pending.'
  where order_reference::text=v_order_id::text and stripe_event_id=v_stripe_event_id;

  return jsonb_build_object(
    'status','FULFILLED_UNVERIFIED','order_id',v_order_id,
    'entitlement_id',v_entitlement_id,'fulfillment_request_id',v_fulfillment_id
  );
end;
$$;

revoke all on function public.get_agent_toll_entitlement(text,text) from public, anon, authenticated;
revoke all on function public.complete_agent_toll_fulfillment(text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.get_agent_toll_entitlement(text,text) to service_role;
grant execute on function public.complete_agent_toll_fulfillment(text,text,text,text,text) to service_role;

create or replace function public.agent_toll_meter_health()
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'ready',
      to_regclass('public.control_bridge_notes') is not null
      and to_regclass('public.revenue_catalog') is not null
      and to_regclass('public.skus') is not null
      and to_regclass('public.revenue_orders') is not null
      and to_regclass('public.revenue_entitlements') is not null
      and to_regclass('public.fulfillment_requests') is not null
      and to_regclass('public.economic_events') is not null
      and to_regclass('public.control_reconciliations') is not null
      and (select count(*)=46 from information_schema.columns where table_schema='public' and (
        (table_name='revenue_catalog' and column_name in ('sku_id','name','lane','description','price_nzd','active','fulfillment_type','currency','updated_at'))
        or (table_name='skus' and column_name in ('id','silo_id','status'))
        or (table_name='revenue_orders' and column_name in ('id','stripe_checkout_session_id','stripe_event_id','stripe_payment_intent_id','sku_id','status'))
        or (table_name='fulfillment_requests' and column_name in ('status','canonical_state','fulfillment_reference','evidence_reference','evidence_status','payload','updated_at','entitlement_id','sku_id'))
        or (table_name='revenue_entitlements' and column_name in ('status','redeemed_at','fulfillment_key','order_id','sku_id','id'))
        or (table_name='economic_events' and column_name in ('stripe_checkout_session','sku_id','fulfilment_verified','evidence_verified','evidence_ref','updated_at'))
        or (table_name='control_reconciliations' and column_name in ('status','fulfillment_verified','checked_at','checked_by','notes','order_reference','stripe_event_id'))
      ))
      and to_regprocedure('public.reserve_agent_toll_call(text,text,text,text,text,integer,text,text)') is not null
      and to_regprocedure('public.complete_agent_toll_call(text,integer,jsonb)') is not null
      and to_regprocedure('public.get_agent_toll_entitlement(text,text)') is not null
      and to_regprocedure('public.complete_agent_toll_fulfillment(text,text,text,text,text)') is not null
      and (select count(*)=7 from public.revenue_catalog rc join public.skus s on s.id=rc.sku_id
           where rc.active=true and s.status='active' and rc.currency='NZD'
             and (rc.sku_id,rc.price_nzd) in (
               ('TOLL-PROBE-1',1),('DECISION-CHECK-100',19),('EVIDENCE-CHECK-100',9),
               ('AGENT-BRIDGE-STARTER-500',5),('MICRO-EVENT-INGEST-200',2),
               ('ROUTE-PASS-30D-5000',9),('TOLL-NEXUS-25',19)
             )),
    'schema','dreamledger/agent-toll-meter-health/v1',
    'authority','public.control_bridge_notes',
    'checked_at',clock_timestamp()
  );
$$;

revoke all on function public.agent_toll_meter_health() from public, anon, authenticated;
grant execute on function public.agent_toll_meter_health() to service_role;
