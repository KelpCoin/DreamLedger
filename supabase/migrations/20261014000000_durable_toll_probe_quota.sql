-- First-dollar Toll Probe: durable entitlement and atomic one-call quota ledger.
-- Deliberately supports only the NZ$0.50 toll-probe SKU until broader scopes pass acceptance.
create table if not exists public.toll_entitlements (
  key_id text primary key check (length(key_id) between 1 and 128),
  checkout_session_id text not null unique check (length(checkout_session_id) between 1 and 255),
  payment_intent_id text,
  scope text not null check (scope = 'toll-probe'),
  calls_granted integer not null check (calls_granted = 1),
  calls_remaining integer not null check (calls_remaining between 0 and calls_granted),
  expires_at timestamptz not null,
  status text not null default 'active' check (status in ('active','revoked','expired','exhausted')),
  livemode boolean not null check (livemode is true),
  amount_minor integer not null check (amount_minor = 50),
  currency text not null check (currency = 'nzd'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.toll_usage_events (
  idempotency_key text primary key check (length(idempotency_key) between 1 and 255),
  key_id text not null references public.toll_entitlements(key_id),
  scope text not null check (scope = 'toll-probe'),
  units integer not null check (units = 1),
  remaining_after integer not null check (remaining_after between 0 and 1),
  consumed_at timestamptz not null default now()
);

alter table public.toll_entitlements enable row level security;
alter table public.toll_usage_events enable row level security;
revoke all on public.toll_entitlements from public, anon, authenticated;
revoke all on public.toll_usage_events from public, anon, authenticated;
grant select, insert, update on public.toll_entitlements to service_role;
grant select, insert on public.toll_usage_events to service_role;

create or replace function public.register_toll_probe_entitlement(
  p_key_id text,
  p_checkout_session_id text,
  p_payment_intent_id text,
  p_scope text,
  p_calls_granted integer,
  p_expires_at timestamptz,
  p_livemode boolean,
  p_amount_minor integer,
  p_currency text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.toll_entitlements%rowtype;
begin
  if coalesce(length(p_key_id),0) not between 1 and 128
     or coalesce(length(p_checkout_session_id),0) not between 1 and 255 then
    raise exception 'valid key and checkout session identifiers required' using errcode='22023';
  end if;
  if p_scope <> 'toll-probe' or p_calls_granted <> 1
     or p_livemode is distinct from true
     or p_amount_minor <> 50
     or lower(coalesce(p_currency,'')) <> 'nzd'
     or p_expires_at <= now()
     or p_expires_at > now() + interval '31 days' then
    raise exception 'toll probe settlement contract mismatch' using errcode='22023';
  end if;

  insert into public.toll_entitlements(
    key_id, checkout_session_id, payment_intent_id, scope, calls_granted,
    calls_remaining, expires_at, status, livemode, amount_minor, currency
  ) values (
    p_key_id, p_checkout_session_id, nullif(p_payment_intent_id,''), p_scope,
    1, 1, p_expires_at, 'active', true, 50, 'nzd'
  ) on conflict (checkout_session_id) do nothing;

  select * into v_row
  from public.toll_entitlements
  where checkout_session_id = p_checkout_session_id
  for update;

  if not found
     or v_row.key_id <> p_key_id
     or v_row.scope <> p_scope
     or v_row.livemode is distinct from true
     or v_row.amount_minor <> 50
     or v_row.currency <> 'nzd' then
    raise exception 'checkout session already bound to a different entitlement' using errcode='23505';
  end if;

  return jsonb_build_object(
    'ok', true, 'key_id', v_row.key_id, 'scope', v_row.scope,
    'calls_granted', v_row.calls_granted, 'calls_remaining', v_row.calls_remaining,
    'expires_at', v_row.expires_at, 'status', v_row.status
  );
end;
$$;

create or replace function public.consume_toll_probe_quota(
  p_key_id text,
  p_scope text,
  p_idempotency_key text,
  p_units integer default 1
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.toll_entitlements%rowtype;
  v_event public.toll_usage_events%rowtype;
  v_remaining integer;
begin
  if coalesce(length(p_key_id),0) not between 1 and 128
     or coalesce(length(p_idempotency_key),0) not between 1 and 255
     or p_scope <> 'toll-probe'
     or p_units <> 1 then
    raise exception 'valid toll probe quota request required' using errcode='22023';
  end if;

  select * into v_row
  from public.toll_entitlements
  where key_id = p_key_id
  for update;
  if not found then
    raise exception 'durable toll entitlement not found' using errcode='P0002';
  end if;

  select * into v_event
  from public.toll_usage_events
  where idempotency_key = p_idempotency_key;

  if found then
    if v_event.key_id <> p_key_id or v_event.scope <> p_scope or v_event.units <> p_units then
      raise exception 'idempotency key is already bound to another request' using errcode='23505';
    end if;
    return jsonb_build_object(
      'ok', true, 'replayed', true, 'key_id', v_event.key_id,
      'calls_remaining', v_event.remaining_after, 'consumed_at', v_event.consumed_at
    );
  end if;

  if v_row.scope <> p_scope then
    raise exception 'toll entitlement scope denied' using errcode='42501';
  end if;
  if v_row.status <> 'active' or v_row.expires_at <= now() then
    raise exception 'toll entitlement expired or revoked' using errcode='22023';
  end if;
  if v_row.calls_remaining < p_units then
    raise exception 'toll quota exhausted' using errcode='22023';
  end if;

  v_remaining := v_row.calls_remaining - p_units;
  update public.toll_entitlements
  set calls_remaining = v_remaining,
      status = case when v_remaining = 0 then 'exhausted' else status end,
      updated_at = now()
  where key_id = p_key_id;

  insert into public.toll_usage_events(idempotency_key, key_id, scope, units, remaining_after)
  values (p_idempotency_key, p_key_id, p_scope, p_units, v_remaining)
  returning * into v_event;

  return jsonb_build_object(
    'ok', true, 'replayed', false, 'key_id', p_key_id,
    'calls_remaining', v_remaining, 'consumed_at', v_event.consumed_at
  );
end;
$$;

revoke all on function public.register_toll_probe_entitlement(text,text,text,text,integer,timestamptz,boolean,integer,text) from public, anon, authenticated;
revoke all on function public.consume_toll_probe_quota(text,text,text,integer) from public, anon, authenticated;
grant execute on function public.register_toll_probe_entitlement(text,text,text,text,integer,timestamptz,boolean,integer,text) to service_role;
grant execute on function public.consume_toll_probe_quota(text,text,text,integer) to service_role;
