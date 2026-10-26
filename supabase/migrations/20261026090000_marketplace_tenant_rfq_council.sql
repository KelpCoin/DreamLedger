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
  exists (select 1 from public.marketplace_memberships m
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
  status='draft' and exists (select 1 from public.marketplace_memberships m
    where m.organization_id=marketplace_proposals.seller_organization_id
      and m.user_id=(select auth.uid()) and m.status='active'
      and m.role in ('owner','admin','seller'))
) with check (
  status='draft' and exists (select 1 from public.marketplace_memberships m
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
