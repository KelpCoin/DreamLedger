-- Settlement + work-ledger hardening.
-- Aligns the live marketplace schema with the settlement consumer and local mailbox worker.

create table if not exists public.processed_webhook_events (
  provider_event_id text primary key,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending','processing','done','failed')),
  lease_owner text,
  lease_expires_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  started_at timestamptz,
  completed_at timestamptz,
  error text
);

create index if not exists processed_webhook_events_drain_idx
  on public.processed_webhook_events (status, received_at);
create index if not exists processed_webhook_events_lease_idx
  on public.processed_webhook_events (status, lease_expires_at)
  where status = 'processing';

alter table public.processed_webhook_events enable row level security;
revoke all on public.processed_webhook_events from anon, authenticated;

create or replace function public.settlement_claim_batch(
  p_worker_id text,
  p_max integer,
  p_lease_secs integer
) returns table (provider_event_id text, payload jsonb, attempt_count integer)
language plpgsql security definer set search_path = '' as $$
begin
  if p_max < 1 or p_max > 100 then raise exception 'invalid batch size' using errcode = 'P0001'; end if;
  if p_lease_secs < 5 or p_lease_secs > 3600 then raise exception 'invalid lease seconds' using errcode = 'P0001'; end if;
  return query
  with candidates as (
    select p.provider_event_id
    from public.processed_webhook_events p
    where p.status = 'pending' or (p.status = 'processing' and p.lease_expires_at <= now())
    order by p.received_at asc
    limit p_max
    for update skip locked
  )
  update public.processed_webhook_events p
  set status = 'processing', lease_owner = p_worker_id,
      lease_expires_at = now() + make_interval(secs => p_lease_secs),
      attempt_count = p.attempt_count + 1,
      started_at = coalesce(p.started_at, now()), error = null
  from candidates c
  where p.provider_event_id = c.provider_event_id
  returning p.provider_event_id, p.payload, p.attempt_count;
end;
$$;

create or replace function public.settlement_finish(p_event_id text,p_status text,p_error text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_updated integer;
begin
  if p_status not in ('done','failed') then raise exception 'invalid settlement terminal status' using errcode = 'P0001'; end if;
  update public.processed_webhook_events
  set status=p_status, completed_at=now(), error=p_error, lease_expires_at=null
  where provider_event_id=p_event_id and status='processing';
  get diagnostics v_updated=row_count;
  return v_updated=1;
end;
$$;

revoke execute on function public.settlement_claim_batch(text,integer,integer) from public, anon, authenticated;
revoke execute on function public.settlement_finish(text,text,text) from public, anon, authenticated;
grant execute on function public.settlement_claim_batch(text,integer,integer) to service_role;
grant execute on function public.settlement_finish(text,text,text) to service_role;

-- Canonical marketplace schema uses order_state/state_version. Settlement authority is enforced here.
create or replace function public.transition_marketplace_order(
  p_order_id uuid,p_expected_version bigint,p_to_state text,p_actor_user_id uuid,
  p_actor_org_id uuid default null,p_idempotency_key text default null,p_reason text default null
) returns public.marketplace_orders
language plpgsql security definer set search_path='' as $$
declare r public.marketplace_orders; old_state text; current_version bigint; buyer_org uuid; seller_org uuid;
begin
  if p_to_state not in ('payment_pending','paid','fulfillment','complete','refund_requested','refunded','dispute') then
    raise exception 'invalid order state' using errcode='P0003';
  end if;
  if auth.role() <> 'service_role' and p_actor_user_id is distinct from auth.uid() then
    raise exception 'actor identity does not match authenticated caller' using errcode='P0004';
  end if;
  if p_idempotency_key is not null and exists(select 1 from public.marketplace_order_state_events e where e.order_id=p_order_id and e.idempotency_key=p_idempotency_key) then
    select * into r from public.marketplace_orders where id=p_order_id; return r;
  end if;
  select order_state,state_version,buyer_organization_id,seller_organization_id into old_state,current_version,buyer_org,seller_org
  from public.marketplace_orders where id=p_order_id for update;
  if not found then raise exception 'order not found' using errcode='P0001'; end if;
  if current_version <> p_expected_version then raise exception 'stale order version expected=% actual=%',p_expected_version,current_version using errcode='P0002'; end if;
  if old_state=p_to_state then raise exception 'duplicate order transition without idempotency key' using errcode='P0003'; end if;

  if p_to_state='fulfillment' then
    if auth.role() <> 'service_role' or p_actor_user_id is not null then
      raise exception 'settlement authority required' using errcode='P0005';
    end if;
  end if;

  if auth.role() <> 'service_role' then
    if p_actor_org_id is null or (p_actor_org_id is distinct from buyer_org and p_actor_org_id is distinct from seller_org) then
      raise exception 'actor organization is not bound to order' using errcode='P0004';
    end if;
    if not exists(select 1 from public.marketplace_memberships m where m.organization_id=p_actor_org_id and m.user_id=p_actor_user_id and m.status='active' and m.role in ('owner','admin','buyer','seller','moderator','operator')) then
      raise exception 'actor not authorized for order organization' using errcode='P0004';
    end if;
  end if;

  update public.marketplace_orders
  set order_state=p_to_state,state_version=state_version+1,state_updated_at=now(),state_updated_by=p_actor_user_id
  where id=p_order_id and state_version=p_expected_version
  returning * into r;
  if not found then raise exception 'concurrent modification' using errcode='P0002'; end if;
  insert into public.marketplace_order_state_events(order_id,from_state,to_state,state_version,actor_user_id,actor_organization_id,idempotency_key,reason)
  values(p_order_id,old_state,p_to_state,r.state_version,p_actor_user_id,p_actor_org_id,p_idempotency_key,p_reason);
  return r;
end;
$$;

revoke execute on function public.transition_marketplace_order(uuid,bigint,text,uuid,uuid,text,text) from public, anon;
grant execute on function public.transition_marketplace_order(uuid,bigint,text,uuid,uuid,text,text) to authenticated, service_role;

-- Compatibility RPCs for the local worker. All mutations still pass through the fenced canonical functions.
create or replace function public.claim_task(p_worker_id text,p_tier text,p_lease_secs integer default 30)
returns table(task_id uuid,role text,objective text,input jsonb,lease_token uuid,attempt_count integer)
language plpgsql security definer set search_path='' as $$
begin
  return query select t.task_id,t.role,t.objective,t.input,t.lease_token,t.attempt_count from public.claim_orchestrator_task(p_tier,p_worker_id,p_lease_secs) t;
end;
$$;

create or replace function public.renew_task_lease_for_worker(p_task_id uuid,p_lease_token uuid,p_worker text,p_lease_secs integer default 30)
returns boolean language sql security definer set search_path='' as $$
  select public.renew_orchestrator_task_lease(p_task_id,p_lease_token,p_worker,p_lease_secs);
$$;

create or replace function public.finish_task_for_worker(p_task_id uuid,p_lease_token uuid,p_worker text,p_status text,p_result jsonb default null,p_error text default null)
returns boolean language sql security definer set search_path='' as $$
  select exists(select 1 from public.finish_orchestrator_task(p_task_id,p_lease_token,p_worker,p_status,p_result,p_error));
$$;

revoke execute on function public.claim_task(text,text,integer) from public, anon, authenticated;
revoke execute on function public.renew_task_lease_for_worker(uuid,uuid,text,integer) from public, anon, authenticated;
revoke execute on function public.finish_task_for_worker(uuid,uuid,text,text,jsonb,text) from public, anon, authenticated;
grant execute on function public.claim_task(text,text,integer) to service_role;
grant execute on function public.renew_task_lease_for_worker(uuid,uuid,text,integer) to service_role;
grant execute on function public.finish_task_for_worker(uuid,uuid,text,text,jsonb,text) to service_role;
