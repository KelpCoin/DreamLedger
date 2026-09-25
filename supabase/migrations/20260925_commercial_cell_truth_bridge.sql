-- Commercial cell truth bridge: fulfillment completion promotes the same Stripe economic event to VERIFIED.
-- Applied live to project wbwgroygjeyukkspnqiy on 2026-09-25.
-- This migration records the production function change for source-of-truth history.

create or replace function public.marketplace_complete_diagnostic_fulfillment(
  p_fulfillment_id uuid,
  p_worker_id text,
  p_lease_token text,
  p_bucket text,
  p_storage_path text,
  p_sha256 text,
  p_mime_type text,
  p_byte_size bigint,
  p_delivery_url text
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
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
    set fulfilment_verified=true,
        evidence_verified=true,
        verification_status='VERIFIED',
        observation_mode='OBSERVED',
        scope='EXTERNAL',
        resulting_state='ECONOMIC_EVENT_RECORDED',
        updated_at=now()
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
