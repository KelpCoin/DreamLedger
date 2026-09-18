-- Economic chain hardening: verified fulfillment is the final predicate for MATCHED.
alter table public.control_reconciliations
  add column if not exists fulfillment_verified boolean not null default false;

alter table public.control_reconciliations drop column status;

alter table public.control_reconciliations
  add column status text generated always as (
    case
      when payment_exists and order_exists and ledger_exists and amounts_match and fulfillment_verified then 'MATCHED'
      when payment_exists and order_exists and ledger_exists and amounts_match then 'RECONCILED'
      when payment_exists or order_exists or ledger_exists then 'MISMATCH'
      else 'UNVERIFIED'
    end
  ) stored;

create or replace function public.record_economic_outcome(
  p_offer_id uuid,
  p_outcome_type text,
  p_amount_nzd numeric default 0,
  p_external_reference text default null,
  p_evidence_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_outcome_id uuid;
  v_candidate_id uuid;
  v_action_id uuid;
  v_existing uuid;
  v_evidence_ids uuid[] := '{}'::uuid[];
begin
  if p_outcome_type not in ('PAYMENT_ATTEMPT','PAID','REFUNDED','FULFILLED','REPEAT_PURCHASE') then
    raise exception 'unsupported economic outcome type: %', p_outcome_type;
  end if;

  if p_evidence_id is not null
     and p_evidence_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    v_evidence_ids := array[p_evidence_id::uuid];
  end if;

  select eo.outcome_id into v_existing
  from public.economic_outcomes eo
  where p_external_reference is not null
    and eo.external_reference = p_external_reference
    and eo.outcome_type = p_outcome_type
  limit 1;
  if v_existing is not null then return v_existing; end if;

  select ea.candidate_id, ea.action_id into v_candidate_id, v_action_id
  from public.economic_actions ea
  where ea.offer_id = p_offer_id
  order by ea.created_at desc nulls last
  limit 1;

  insert into public.economic_outcomes(
    candidate_id,action_id,offer_id,outcome_type,amount_nzd,
    founder_minutes,fulfilment_minutes,acquisition_cost_nzd,payment_fees_nzd,
    external_reference,observed_at,evidence_ids,metadata
  )
  values(
    v_candidate_id,v_action_id,p_offer_id,p_outcome_type,coalesce(p_amount_nzd,0),
    0,0,0,0,p_external_reference,now(),v_evidence_ids,
    coalesce(p_metadata,'{}'::jsonb) ||
    jsonb_build_object('recorder','record_economic_outcome','schema_version',1)
  )
  returning outcome_id into v_outcome_id;

  return v_outcome_id;
end;
$function$;

create or replace function public.capture_economic_fulfillment_outcome()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_order_id uuid;
  v_amount numeric;
  v_offer_id uuid;
  v_reference text;
  v_event_id text;
begin
  if lower(coalesce(new.status,'')) not in ('fulfilled','completed','complete','delivered') then
    return new;
  end if;

  select re.order_id, ro.amount_nzd, ro.stripe_checkout_session_id, ro.stripe_event_id
    into v_order_id, v_amount, v_reference, v_event_id
  from public.revenue_entitlements re
  join public.revenue_orders ro on ro.id = re.order_id
  where re.id = new.entitlement_id
  limit 1;

  if v_order_id is null or v_event_id is null then return new; end if;

  select id into v_offer_id
  from public.offers
  where lower(title)='commander deck diagnostic'
    and lifecycle_status='live'
    and visibility in ('featured','public')
    and final_price_cents=round(coalesce(v_amount,29)*100)
  order by updated_at desc
  limit 1;

  if v_offer_id is not null then
    perform public.record_economic_outcome(
      v_offer_id,'FULFILLED',coalesce(v_amount,0),coalesce(v_reference,new.id::text),new.id::text,
      jsonb_build_object('classification','OBSERVED','source','fulfillment_requests_trigger',
                         'fulfillment_request_id',new.id,'sku_id',new.sku_id)
    );
  end if;

  update public.economic_events
  set fulfilment_verified=true,evidence_verified=true,updated_at=now()
  where event_id=v_event_id and payment_settled=true;

  update public.control_reconciliations
  set fulfillment_verified=true,
      checked_at=now(),
      checked_by='capture_economic_fulfillment_outcome',
      notes='Verified fulfillment completed for the same Stripe event identity.'
  where stripe_event_id=v_event_id;

  return new;
end;
$function$;

create or replace function public.marketplace_complete_diagnostic_fulfillment(
  p_fulfillment_id uuid,p_worker_id text,p_lease_token text,p_bucket text,p_storage_path text,
  p_sha256 text,p_mime_type text,p_byte_size bigint,p_delivery_url text
)
returns boolean
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_f public.marketplace_fulfillments%rowtype;
  v_order public.marketplace_orders%rowtype;
  v_artifact_id uuid;
  v_expires timestamptz;
  v_event_id text;
begin
  select * into v_f from public.marketplace_fulfillments where fulfillment_id=p_fulfillment_id for update;
  if not found then raise exception 'fulfillment not found'; end if;
  if v_f.status<>'in_progress' then raise exception 'fulfillment not in progress'; end if;
  if coalesce(v_f.metadata->>'worker_id','')<>p_worker_id then raise exception 'worker fence mismatch'; end if;
  if coalesce(v_f.metadata->>'lease_token','')<>p_lease_token then raise exception 'lease token mismatch'; end if;
  v_expires:=nullif(v_f.metadata->>'lease_expires_at','')::timestamptz;
  if v_expires is null or v_expires<=now() then raise exception 'lease expired'; end if;
  if lower(p_bucket)<>'marketplace-fulfillment' then raise exception 'invalid evidence bucket'; end if;
  if p_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'invalid sha256'; end if;
  if p_byte_size<=0 then raise exception 'invalid artifact size'; end if;
  if coalesce(p_delivery_url,'')='' then raise exception 'delivery url required'; end if;

  select * into v_order from public.marketplace_orders where id=v_f.order_id for update;

  insert into public.marketplace_fulfillment_artifacts(
    fulfillment_id,storage_bucket,storage_path,sha256,mime_type,byte_size,verifier_version,delivery_verified_at
  )
  values(
    p_fulfillment_id,p_bucket,p_storage_path,lower(p_sha256),p_mime_type,p_byte_size,
    'marketplace-diagnostic-verifier-v1',now()
  )
  on conflict (fulfillment_id) do update set
    storage_bucket=excluded.storage_bucket,storage_path=excluded.storage_path,sha256=excluded.sha256,
    mime_type=excluded.mime_type,byte_size=excluded.byte_size,verifier_version=excluded.verifier_version,
    delivery_verified_at=excluded.delivery_verified_at
  returning artifact_id into v_artifact_id;

  update public.marketplace_fulfillments
  set status='fulfilled',evidence_ref='artifact:'||v_artifact_id::text,delivery_url=p_delivery_url,
      delivered_at=now(),completed_at=now(),
      metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
        'evidence_state','VERIFIED','artifact_id',v_artifact_id::text,'artifact_bucket',p_bucket,
        'artifact_storage_path',p_storage_path,'artifact_sha256',lower(p_sha256),
        'delivery_verified_at',now()::text
      ),updated_at=now()
  where fulfillment_id=p_fulfillment_id;

  update public.marketplace_orders
  set fulfillment_status='fulfilled',order_state='complete',state_version=state_version+1,
      state_updated_at=now(),evidence_id='artifact:'||v_artifact_id::text
  where id=v_order.id;

  insert into public.marketplace_fulfillment_events(fulfillment_id,from_status,to_status,evidence_ref,note)
  values(p_fulfillment_id,'in_progress','fulfilled','artifact:'||v_artifact_id::text,
         'artifact hash and storage presence verified; lease fence valid');

  insert into public.marketplace_audit_events(entity_type,entity_id,action,from_state,to_state,evidence_ref,metadata)
  values('order',v_order.id::text,'FULFILLMENT_VERIFIED','fulfillment','complete',
         'artifact:'||v_artifact_id::text,
         jsonb_build_object('fulfillment_id',p_fulfillment_id,'artifact_sha256',lower(p_sha256),'delivery_url',p_delivery_url));

  select mp.raw_event_id into v_event_id
  from public.marketplace_payments mp
  where mp.order_id=v_order.id
  order by mp.paid_at desc
  limit 1;

  if v_event_id is not null then
    update public.economic_events
    set fulfilment_verified=true,evidence_verified=true,updated_at=now()
    where event_id=v_event_id and payment_settled=true;

    update public.control_reconciliations
    set fulfillment_verified=true,
        checked_at=now(),
        checked_by='marketplace_complete_diagnostic_fulfillment',
        notes='Verified marketplace diagnostic artifact completed for the same Stripe event identity.'
    where stripe_event_id=v_event_id;
  end if;

  return true;
end;
$function$;