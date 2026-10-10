-- Payment webhook concurrency guard for DreamLedger's existing revenue path.
-- This migration intentionally fails if existing duplicate economic keys prevent
-- the unique indexes from being established. Resolve duplicates from Stripe evidence;
-- never silently delete orders or entitlements.
create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  processed boolean not null default false,
  processed_at timestamptz,
  payload jsonb,
  created_at timestamptz not null default now()
);

alter table public.stripe_webhook_events
  add column if not exists processing_started_at timestamptz,
  add column if not exists attempts integer not null default 0;

create unique index if not exists stripe_webhook_events_event_id_uidx
  on public.stripe_webhook_events (event_id);

create unique index if not exists revenue_orders_stripe_event_id_uidx
  on public.revenue_orders (stripe_event_id)
  where stripe_event_id is not null;

create unique index if not exists revenue_orders_checkout_session_uidx
  on public.revenue_orders (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create unique index if not exists revenue_entitlements_order_id_uidx
  on public.revenue_entitlements (order_id)
  where order_id is not null;

create unique index if not exists fulfillment_requests_entitlement_id_uidx
  on public.fulfillment_requests (entitlement_id)
  where entitlement_id is not null;

create or replace function public.claim_stripe_webhook_event(
  p_event_id text,
  p_event_type text,
  p_payload jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claimed text;
  v_processed boolean;
begin
  if coalesce(trim(p_event_id), '') = '' or coalesce(trim(p_event_type), '') = '' then
    raise exception 'event id and event type are required';
  end if;

  insert into public.stripe_webhook_events (
    event_id, event_type, processed, processed_at, payload,
    processing_started_at, attempts
  ) values (
    p_event_id, p_event_type, false, null, p_payload, now(), 1
  )
  on conflict (event_id) do update
    set event_type = excluded.event_type,
        payload = excluded.payload,
        processing_started_at = now(),
        attempts = public.stripe_webhook_events.attempts + 1
    where public.stripe_webhook_events.processed is not true
      and (
        public.stripe_webhook_events.processing_started_at is null
        or public.stripe_webhook_events.processing_started_at < now() - interval '5 minutes'
      )
  returning event_id into v_claimed;

  if v_claimed is not null then
    return jsonb_build_object('claimed', true, 'processed', false);
  end if;

  select processed into v_processed
    from public.stripe_webhook_events
    where event_id = p_event_id;

  return jsonb_build_object(
    'claimed', false,
    'processed', coalesce(v_processed, false)
  );
end;
$$;

revoke all on function public.claim_stripe_webhook_event(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.claim_stripe_webhook_event(text, text, jsonb) to service_role;
