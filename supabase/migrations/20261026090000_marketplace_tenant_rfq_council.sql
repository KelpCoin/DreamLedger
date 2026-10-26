-- Multi-tenant B2B marketplace extension.
-- Idempotent schema addition only. Existing payment, order and listing writers remain authoritative.
create extension if not exists pgcrypto;

create table if not exists public.marketplace_rfq_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.marketplace_organizations(organization_id) on delete cascade,
  requester_user_id uuid not null references auth.users(id) on delete restrict,
  silo_id text not null,
  title text not null check (length(trim(title)) between 3 and 180),
  description text not null check (length(trim(description)) between 10 and 8000),
  budget_minor bigint check (budget_minor is null or budget_minor >= 0),
  currency text not null default 'NZD' check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'draft' check (status in ('draft','review','open','matched','closed','cancelled')),
  visibility text not null default 'private' check (visibility in ('private','marketplace')),
  idempotency_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);
create index if not exists marketplace_rfq_org_status_idx
  on public.marketplace_rfq_requests(organization_id,status,created_at desc);
create index if not exists marketplace_rfq_discovery_idx
  on public.marketplace_rfq_requests(silo_id,status,created_at desc)
  where visibility='marketplace' and status='open';

create table if not exists public.marketplace_organization_silos (
  organization_id uuid not null references public.marketplace_organizations(organization_id) on delete cascade,
  silo_id text not null,
  status text not null default 'active' check (status in ('active','suspended')),
  created_at timestamptz not null default now(),
  primary key (organization_id,silo_id)
);
alter table public.marketplace_organization_silos enable row level security;
revoke all on public.marketplace_organization_silos from anon;
grant select on public.marketplace_organization_silos to authenticated;
drop policy if exists marketplace_org_silos_member_read on public.marketplace_organization_silos;
create policy marketplace_org_silos_member_read on public.marketplace_organization_silos
for select to authenticated using (
  exists (select 1 from public.marketplace_memberships m where m.organization_id=marketplace_organization_silos.organization_id and m.user_id=(select auth.uid()) and m.status='active')
);

create table if not exists public.marketplace_proposals (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.marketplace_rfq_requests(id) on delete cascade,
  seller_organization_id uuid not null references public.marketplace_organizations(organization_id) on delete cascade,
  submitted_by uuid not null references auth.users(id) on delete restrict,
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  lead_time_days integer check (lead_time_days is null or lead_time_days >= 0),
  scope text not null check (length(trim(scope)) between 10 and 8000),
  status text not null default 'draft' check (status in ('draft','submitted','shortlisted','accepted','rejected','withdrawn')),
  evidence jsonb not null default '{}'::jsonb,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (seller_organization_id,idempotency_key)
);
create index if not exists marketplace_proposals_rfq_idx on public.marketplace_proposals(rfq_id,status,created_at);
create index if not exists marketplace_proposals_seller_idx on public.marketplace_proposals(seller_organization_id,status,created_at desc);

create table if not exists public.marketplace_council_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.marketplace_organizations(organization_id) on delete cascade,
  silo_id text not null,
  entity_type text not null check (entity_type in ('listing','rfq','proposal','offer','fulfillment')),
  entity_id uuid not null,
  schema_version text not null,
  status text not null check (status in ('queued','running','review_proposal','blocked','failed')),
  input_hash text not null check (input_hash ~ '^[0-9a-f]{64}$'),
  output_hash text check (output_hash is null or output_hash ~ '^[0-9a-f]{64}$'),
  model_receipts jsonb not null default '[]'::jsonb,
  unresolved_risks jsonb not null default '[]'::jsonb,
  publish_authorized boolean not null default false check (publish_authorized = false),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists marketplace_council_org_recent_idx
  on public.marketplace_council_runs(organization_id,created_at desc);
create index if not exists marketplace_council_entity_idx
  on public.marketplace_council_runs(entity_type,entity_id,created_at desc);

alter table public.marketplace_rfq_requests add column if not exists state_version bigint not null default 1;
alter table public.marketplace_proposals add column if not exists state_version bigint not null default 1;

create table if not exists public.marketplace_rfq_state_events (
  event_id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.marketplace_rfq_requests(id) on delete cascade,
  from_state text not null,
  to_state text not null,
  state_version bigint not null,
  actor_user_id uuid not null,
  actor_organization_id uuid not null,
  reason text,
  created_at timestamptz not null default now(),
  unique(rfq_id,state_version)
);
create table if not exists public.marketplace_proposal_state_events (
  event_id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.marketplace_proposals(id) on delete cascade,
  from_state text not null,
  to_state text not null,
  state_version bigint not null,
  actor_user_id uuid not null,
  actor_organization_id uuid not null,
  reason text,
  created_at timestamptz not null default now(),
  unique(proposal_id,state_version)
);
alter table public.marketplace_rfq_state_events enable row level security;
alter table public.marketplace_proposal_state_events enable row level security;
revoke all on public.marketplace_rfq_state_events from anon;
revoke all on public.marketplace_proposal_state_events from anon;
grant select on public.marketplace_rfq_state_events to authenticated;
grant select on public.marketplace_proposal_state_events to authenticated;
drop policy if exists marketplace_rfq_events_member_read on public.marketplace_rfq_state_events;
create policy marketplace_rfq_events_member_read on public.marketplace_rfq_state_events
for select to authenticated using (
  exists (select 1 from public.marketplace_rfq_requests r
    join public.marketplace_memberships m on m.organization_id=r.organization_id
    where r.id=marketplace_rfq_state_events.rfq_id and m.user_id=(select auth.uid()) and m.status='active')
);
drop policy if exists marketplace_proposal_events_member_read on public.marketplace_proposal_state_events;
create policy marketplace_proposal_events_member_read on public.marketplace_proposal_state_events
for select to authenticated using (
  exists (select 1 from public.marketplace_proposals p
    join public.marketplace_memberships m on m.organization_id=p.seller_organization_id
    where p.id=marketplace_proposal_state_events.proposal_id and m.user_id=(select auth.uid()) and m.status='active')
  or exists (select 1 from public.marketplace_proposals p
    join public.marketplace_rfq_requests r on r.id=p.rfq_id
    join public.marketplace_memberships m on m.organization_id=r.organization_id
    where p.id=marketplace_proposal_state_events.proposal_id and m.user_id=(select auth.uid()) and m.status='active')
);

create or replace function public.transition_marketplace_rfq(
  p_rfq_id uuid, p_expected_version bigint, p_to_status text,
  p_actor_organization_id uuid, p_reason text default null
) returns public.marketplace_rfq_requests
language plpgsql security definer set search_path=public as $
declare r public.marketplace_rfq_requests; old_status text; actor_role text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into r from public.marketplace_rfq_requests where id=p_rfq_id for update;
  if not found then raise exception 'RFQ_NOT_FOUND'; end if;
  if r.state_version <> p_expected_version then raise exception 'STALE_RFV_VERSION'; end if;
  select role into actor_role from public.marketplace_memberships
    where organization_id=r.organization_id and user_id=auth.uid()
      and status='active' and role in ('owner','admin','buyer','moderator','operator')
    order by case role when 'owner' then 1 when 'admin' then 2 else 3 end limit 1;
  if actor_role is null or p_actor_organization_id is distinct from r.organization_id then raise exception 'RFQ_TENANT_FORBIDDEN'; end if;
  old_status := r.status;
  if old_status='draft' and p_to_status in ('review','cancelled') then
    null;
  elsif old_status='review' and p_to_status='open' and actor_role in ('owner','admin','moderator','operator') then
    null;
  elsif old_status in ('open','matched') and p_to_status='closed' then
    null;
  elsif old_status in ('draft','review') and p_to_status='cancelled' then
    null;
  else raise exception 'INVALID_RFQ_TRANSITION:% -> %',old_status,p_to_status;
  end if;
  update public.marketplace_rfq_requests set status=p_to_status, visibility=case when p_to_status='open' then 'marketplace' else visibility end, state_version=state_version+1,updated_at=now()
    where id=p_rfq_id returning * into r;
  insert into public.marketplace_rfq_state_events(rfq_id,from_state,to_state,state_version,actor_user_id,actor_organization_id,reason)
    values(p_rfq_id,old_status,p_to_status,r.state_version,auth.uid(),p_actor_organization_id,p_reason);
  return r;
end;
$;

create or replace function public.transition_marketplace_proposal(
  p_proposal_id uuid, p_expected_version bigint, p_to_status text,
  p_actor_organization_id uuid, p_reason text default null
) returns public.marketplace_proposals
language plpgsql security definer set search_path=public as $
declare p public.marketplace_proposals; r public.marketplace_rfq_requests; old_status text; actor_role text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into p from public.marketplace_proposals where id=p_proposal_id for update;
  if not found then raise exception 'PROPOSAL_NOT_FOUND'; end if;
  if p.state_version <> p_expected_version then raise exception 'STALE_PROPOSAL_VERSION'; end if;
  select * into r from public.marketplace_rfq_requests where id=p.rfq_id;
  if not found then raise exception 'RFQ_NOT_FOUND'; end if;
  old_status := p.status;
  if p_to_status in ('submitted','withdrawn') then
    select role into actor_role from public.marketplace_memberships
      where organization_id=p.seller_organization_id and user_id=auth.uid()
        and status='active' and role in ('owner','admin','seller')
      order by case role when 'owner' then 1 when 'admin' then 2 else 3 end limit 1;
    if actor_role is null or p_actor_organization_id is distinct from p.seller_organization_id then raise exception 'SELLER_TENANT_FORBIDDEN'; end if;
    if not ((old_status='draft' and p_to_status='submitted') or (old_status in ('submitted','shortlisted') and p_to_status='withdrawn')) then
      raise exception 'INVALID_SELLER_PROPOSAL_TRANSITION';
    end if;
  elsif p_to_status in ('shortlisted','accepted','rejected') then
    select role into actor_role from public.marketplace_memberships
      where organization_id=r.organization_id and user_id=auth.uid()
        and status='active' and role in ('owner','admin','buyer')
      order by case role when 'owner' then 1 when 'admin' then 2 else 3 end limit 1;
    if actor_role is null or p_actor_organization_id is distinct from r.organization_id then raise exception 'BUYER_TENANT_FORBIDDEN'; end if;
    if r.status not in ('open','matched') or not ((old_status='submitted' and p_to_status in ('shortlisted','rejected')) or (old_status='shortlisted' and p_to_status in ('accepted','rejected'))) then
      raise exception 'INVALID_BUYER_PROPOSAL_TRANSITION';
    end if;
  else raise exception 'INVALID_PROPOSAL_TARGET';
  end if;
  update public.marketplace_proposals set status=p_to_status,state_version=state_version+1,updated_at=now()
    where id=p_proposal_id returning * into p;
  insert into public.marketplace_proposal_state_events(proposal_id,from_state,to_state,state_version,actor_user_id,actor_organization_id,reason)
    values(p_proposal_id,old_status,p_to_status,p.state_version,auth.uid(),p_actor_organization_id,p_reason);
  return p;
end;
$;
revoke all on function public.transition_marketplace_rfq(uuid,bigint,text,uuid,text) from public, anon;
revoke all on function public.transition_marketplace_proposal(uuid,bigint,text,uuid,text) from public, anon;
grant execute on function public.transition_marketplace_rfq(uuid,bigint,text,uuid,text) to authenticated;
grant execute on function public.transition_marketplace_proposal(uuid,bigint,text,uuid,text) to authenticated;

alter table public.marketplace_rfq_requests enable row level security;
alter table public.marketplace_proposals enable row level security;
alter table public.marketplace_council_runs enable row level security;

revoke all on public.marketplace_rfq_requests from anon;
revoke all on public.marketplace_proposals from anon;
revoke all on public.marketplace_council_runs from anon;
grant select, insert, update on public.marketplace_rfq_requests to authenticated;
grant select, insert, update on public.marketplace_proposals to authenticated;
grant select on public.marketplace_council_runs to authenticated;

drop policy if exists marketplace_rfq_member_read on public.marketplace_rfq_requests;
create policy marketplace_rfq_member_read on public.marketplace_rfq_requests
for select to authenticated using (
  exists (select 1 from public.marketplace_memberships m
    where m.organization_id=marketplace_rfq_requests.organization_id
      and m.user_id=(select auth.uid()) and m.status='active')
  or (visibility='marketplace' and status='open')
);
drop policy if exists marketplace_rfq_member_insert on public.marketplace_rfq_requests;
create policy marketplace_rfq_member_insert on public.marketplace_rfq_requests
for insert to authenticated with check (
  requester_user_id=(select auth.uid()) and status='draft' and visibility='private'
  and exists (select 1 from public.marketplace_memberships m
    where m.organization_id=marketplace_rfq_requests.organization_id
      and m.user_id=(select auth.uid()) and m.status='active'
      and m.role in ('owner','admin','buyer'))
);
drop policy if exists marketplace_rfq_member_update on public.marketplace_rfq_requests;
create policy marketplace_rfq_member_update on public.marketplace_rfq_requests
for update to authenticated using (
  status='draft' and requester_user_id=(select auth.uid())
  and exists (select 1 from public.marketplace_memberships m
    where m.organization_id=marketplace_rfq_requests.organization_id
      and m.user_id=(select auth.uid()) and m.status='active'
      and m.role in ('owner','admin','buyer'))
) with check (
  status='draft' and visibility='private' and requester_user_id=(select auth.uid())
  and exists (select 1 from public.marketplace_memberships m
    where m.organization_id=marketplace_rfq_requests.organization_id
      and m.user_id=(select auth.uid()) and m.status='active'
      and m.role in ('owner','admin','buyer'))
);

drop policy if exists marketplace_proposals_member_read on public.marketplace_proposals;
create policy marketplace_proposals_member_read on public.marketplace_proposals
for select to authenticated using (
  exists (select 1 from public.marketplace_memberships m
    where m.organization_id=marketplace_proposals.seller_organization_id
      and m.user_id=(select auth.uid()) and m.status='active')
  or exists (select 1 from public.marketplace_rfq_requests r
    join public.marketplace_memberships m on m.organization_id=r.organization_id
    where r.id=marketplace_proposals.rfq_id and m.user_id=(select auth.uid()) and m.status='active')
);
drop policy if exists marketplace_proposals_member_insert on public.marketplace_proposals;
create policy marketplace_proposals_member_insert on public.marketplace_proposals
for insert to authenticated with check (
  submitted_by=(select auth.uid()) and status='draft'
  and exists (select 1 from public.marketplace_memberships m
    where m.organization_id=marketplace_proposals.seller_organization_id
      and m.user_id=(select auth.uid()) and m.status='active'
      and m.role in ('owner','admin','seller'))
  and exists (select 1 from public.marketplace_rfq_requests r
    join public.marketplace_organization_silos s
      on s.organization_id=marketplace_proposals.seller_organization_id
     and s.silo_id=r.silo_id and s.status='active'
    where r.id=marketplace_proposals.rfq_id and r.status='open'
      and r.visibility='marketplace'
  )
);
drop policy if exists marketplace_proposals_member_update on public.marketplace_proposals;
create policy marketplace_proposals_member_update on public.marketplace_proposals
for update to authenticated using (
  status='draft' and submitted_by=(select auth.uid()) and exists (select 1 from public.marketplace_memberships m
    where m.organization_id=marketplace_proposals.seller_organization_id
      and m.user_id=(select auth.uid()) and m.status='active'
      and m.role in ('owner','admin','seller'))
) with check (
  status='draft' and submitted_by=(select auth.uid()) and exists (select 1 from public.marketplace_memberships m
    where m.organization_id=marketplace_proposals.seller_organization_id
      and m.user_id=(select auth.uid()) and m.status='active'
      and m.role in ('owner','admin','seller'))
);

drop policy if exists marketplace_council_member_read on public.marketplace_council_runs;
create policy marketplace_council_member_read on public.marketplace_council_runs
for select to authenticated using (
  exists (select 1 from public.marketplace_memberships m
    where m.organization_id=marketplace_council_runs.organization_id
      and m.user_id=(select auth.uid()) and m.status='active')
);

-- Writes to council receipts are deliberately service-role only. LLM output cannot authorize publication.
