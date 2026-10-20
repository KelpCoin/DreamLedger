-- Atomic Stripe webhook inbox claim with expiring leases.
-- This makes duplicate/concurrent delivery claims atomic. Business side effects
-- remain idempotent at their own database boundaries; external effects still
-- require provider idempotency keys and a durable outbox/worker contract.
create table if not exists public.stripe_webhook_inbox (
  event_id text primary key,
  event_type text not null,
  payload jsonb not null,
  status text not null default 'RECEIVED'
    check (status in ('RECEIVED','PROCESSING','DONE','FAILED','PENDING_PRECONDITION')),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  handler_version text not null,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  lease_owner text,
  lease_expires_at timestamptz,
  last_error text
);

create index if not exists stripe_webhook_inbox_drain_idx
  on public.stripe_webhook_inbox(status, received_at);
create index if not exists stripe_webhook_inbox_lease_idx
  on public.stripe_webhook_inbox(status, lease_expires_at)
  where status = 'PROCESSING';

alter table public.stripe_webhook_inbox enable row level security;
revoke all on public.stripe_webhook_inbox from public, anon, authenticated;

create or replace function public.claim_stripe_webhook_event(
  p_event_id text,
  p_event_type text,
  p_payload jsonb,
  p_handler_version text,
  p_lease_owner text,
  p_lease_seconds integer default 90
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if p_event_id is null or btrim(p_event_id) = ''
     or p_event_type is null or btrim(p_event_type) = ''
     or p_payload is null
     or p_handler_version is null or btrim(p_handler_version) = ''
     or p_lease_owner is null or btrim(p_lease_owner) = '' then
    raise exception 'STRIPE_INBOX_REQUIRED_FIELD_MISSING' using errcode = '22023';
  end if;
  if p_lease_seconds < 10 or p_lease_seconds > 600 then
    raise exception 'STRIPE_INBOX_INVALID_LEASE_SECONDS' using errcode = '22023';
  end if;

  insert into public.stripe_webhook_inbox(
    event_id, event_type, payload, status, handler_version,
    attempt_count, lease_owner, lease_expires_at, last_error
  ) values (
    p_event_id, p_event_type, p_payload, 'PROCESSING', p_handler_version,
    1, p_lease_owner, now() + make_interval(secs => p_lease_seconds), null
  )
  on conflict (event_id) do update set
    event_type = excluded.event_type,
    payload = excluded.payload,
    status = 'PROCESSING',
    handler_version = excluded.handler_version,
    attempt_count = public.stripe_webhook_inbox.attempt_count + 1,
    lease_owner = excluded.lease_owner,
    lease_expires_at = excluded.lease_expires_at,
    last_error = null
  where public.stripe_webhook_inbox.status in ('RECEIVED','FAILED')
     or (public.stripe_webhook_inbox.status = 'PROCESSING'
         and public.stripe_webhook_inbox.lease_expires_at <= now())
  returning status into v_status;

  if found then
    return 'CLAIMED';
  end if;

  select status into v_status
  from public.stripe_webhook_inbox
  where event_id = p_event_id;

  if v_status = 'DONE' then return 'DONE'; end if;
  return 'BUSY';
end;
$$;

create or replace function public.finish_stripe_webhook_event(
  p_event_id text,
  p_lease_owner text,
  p_status text,
  p_error text default null
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  if p_status not in ('DONE','FAILED') then
    raise exception 'STRIPE_INBOX_INVALID_FINAL_STATUS' using errcode = '22023';
  end if;

  update public.stripe_webhook_inbox
  set status = p_status,
      processed_at = case when p_status = 'DONE' then now() else null end,
      last_error = left(p_error, 2000),
      lease_owner = null,
      lease_expires_at = null
  where event_id = p_event_id
    and status = 'PROCESSING'
    and lease_owner = p_lease_owner;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

revoke execute on function public.claim_stripe_webhook_event(text,text,jsonb,text,text,integer)
  from public, anon, authenticated;
revoke execute on function public.finish_stripe_webhook_event(text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.claim_stripe_webhook_event(text,text,jsonb,text,text,integer)
  to service_role;
grant execute on function public.finish_stripe_webhook_event(text,text,text,text)
  to service_role;
