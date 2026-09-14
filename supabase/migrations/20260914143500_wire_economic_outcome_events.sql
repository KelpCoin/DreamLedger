begin;

create or replace function public.resolve_economic_offer_id(
  p_offer_key text,
  p_sku_id text,
  p_amount_nzd numeric
)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_offer_id uuid;
begin
  if p_offer_key is not null then
    begin
      select id into v_offer_id from public.offers where id = p_offer_key::uuid limit 1;
    exception when invalid_text_representation then
      v_offer_id := null;
    end;
  end if;

  if v_offer_id is not null then
    return v_offer_id;
  end if;

  if p_offer_key = 'OFFER-CMD-DIAG-29-NZD' or p_sku_id = 'CMD-DIAG-29' then
    select id into v_offer_id
      from public.offers
     where lower(title) = 'commander deck diagnostic'
       and lifecycle_status = 'live'
       and visibility in ('featured','public')
       and final_price_cents = round(coalesce(p_amount_nzd, 29) * 100)
     order by updated_at desc
     limit 1;
  end if;

  return v_offer_id;
end;
$$;

create or replace function public.capture_economic_payment_outcome()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer_id uuid;
  v_amount numeric;
  v_event jsonb;
  v_customer text;
  v_classification text;
begin
  if new.payment_settled is not true then
    return new;
  end if;

  v_amount := coalesce(new.amount_nzd, 0);
  v_offer_id := public.resolve_economic_offer_id(new.offer_id, new.sku_id, v_amount);

  if v_offer_id is null then
    return new;
  end if;

  select payload into v_event
    from public.stripe_webhook_events
   where event_id = new.event_id
   limit 1;

  v_customer := coalesce(v_event->'data'->'object'->'customer_details'->>'email', null);
  v_classification := case
    when coalesce((v_event->>'livemode')::boolean, false) then 'OBSERVED'
    else 'TEST'
  end;

  perform public.record_economic_outcome(
    v_offer_id,
    'PAID',
    v_amount,
    coalesce(new.stripe_checkout_session, new.event_id),
    new.evidence_ref,
    jsonb_build_object(
      'classification', v_classification,
      'customer_ref_present', v_customer is not null,
      'sku_id', new.sku_id,
      'offer_key', new.offer_id,
      'source', 'economic_events_trigger'
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_economic_events_capture_paid on public.economic_events;
create trigger trg_economic_events_capture_paid
after insert or update of payment_settled on public.economic_events
for each row execute function public.capture_economic_payment_outcome();

create or replace function public.capture_economic_fulfillment_outcome()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_amount numeric;
  v_offer_id uuid;
  v_reference text;
  v_metadata jsonb;
begin
  if lower(coalesce(new.status, '')) not in ('fulfilled','completed','complete','delivered') then
    return new;
  end if;

  select re.order_id, ro.amount_nzd, ro.stripe_checkout_session_id
    into v_order_id, v_amount, v_reference
    from public.revenue_entitlements re
    join public.revenue_orders ro on ro.id = re.order_id
   where re.id = new.entitlement_id
   limit 1;

  if v_order_id is null then
    return new;
  end if;

  select id into v_offer_id
    from public.offers
   where lower(title) = 'commander deck diagnostic'
     and lifecycle_status = 'live'
     and visibility in ('featured','public')
     and final_price_cents = round(coalesce(v_amount, 29) * 100)
   order by updated_at desc
   limit 1;

  if v_offer_id is null then
    return new;
  end if;

  v_metadata := jsonb_build_object(
    'classification', 'OBSERVED',
    'source', 'fulfillment_requests_trigger',
    'fulfillment_request_id', new.id,
    'sku_id', new.sku_id
  );

  perform public.record_economic_outcome(
    v_offer_id,
    'FULFILLED',
    coalesce(v_amount, 0),
    coalesce(v_reference, new.id::text),
    new.id::text,
    v_metadata
  );

  return new;
end;
$$;

drop trigger if exists trg_fulfillment_requests_capture_outcome on public.fulfillment_requests;
create trigger trg_fulfillment_requests_capture_outcome
after insert or update of status on public.fulfillment_requests
for each row execute function public.capture_economic_fulfillment_outcome();

revoke all on function public.resolve_economic_offer_id(text,text,numeric) from public, anon, authenticated;
revoke all on function public.capture_economic_payment_outcome() from public, anon, authenticated;
revoke all on function public.capture_economic_fulfillment_outcome() from public, anon, authenticated;
grant execute on function public.resolve_economic_offer_id(text,text,numeric) to service_role;
grant execute on function public.capture_economic_payment_outcome() to service_role;
grant execute on function public.capture_economic_fulfillment_outcome() to service_role;

commit;
