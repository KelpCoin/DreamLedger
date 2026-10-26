-- Neon-native multi-tenant B2B marketplace and Figure Eight schema.
-- This migration is portable PostgreSQL and intentionally has no Supabase Auth dependency.
create schema if not exists marketplace;

create table if not exists marketplace.organizations (
  id uuid primary key,
  display_name text not null check (length(trim(display_name)) between 2 and 120),
  legal_name text,
  owner_principal_id text not null,
  status text not null default 'active' check (status in ('active','suspended','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists marketplace.memberships (
  organization_id uuid not null references marketplace.organizations(id) on delete cascade,
  principal_id text not null,
  role text not null check (role in ('owner','admin','buyer','seller','moderator','operator')),
  status text not null default 'active' check (status in ('active','suspended','revoked')),
  created_at timestamptz not null default now(),
  primary key (organization_id,principal_id,role)
);
create index if not exists marketplace_memberships_principal_idx on marketplace.memberships(principal_id,status);

create table if not exists marketplace.organization_silos (
  organization_id uuid not null references marketplace.organizations(id) on delete cascade,
  silo_id text not null,
  status text not null default 'active' check (status in ('active','suspended')),
  created_at timestamptz not null default now(),
  primary key (organization_id,silo_id)
);

create table if not exists marketplace.listings (
  id uuid primary key,
  organization_id uuid not null references marketplace.organizations(id) on delete restrict,
  silo_id text not null,
  sku text,
  slug text not null,
  title text not null check (length(trim(title)) between 5 and 180),
  description text not null check (length(trim(description)) between 10 and 12000),
  category text not null,
  listing_type text not null default 'product' check (listing_type in ('product','service','wholesale','digital','capacity')),
  price_minor bigint not null check (price_minor >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  quantity integer not null default 1 check (quantity >= 0),
  fulfillment_contract jsonb not null default '{}'::jsonb,
  media jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','review','published','suspended','sold_out','retired')),
  state_version bigint not null default 1,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,slug)
);
create index if not exists marketplace_listings_discovery_idx on marketplace.listings(status,silo_id,category,created_at desc);
create index if not exists marketplace_listings_tenant_idx on marketplace.listings(organization_id,status,updated_at desc);

create table if not exists marketplace.rfqs (
  id uuid primary key,
  organization_id uuid not null references marketplace.organizations(id) on delete restrict,
  requester_principal_id text not null,
  silo_id text not null,
  title text not null check (length(trim(title)) between 5 and 180),
  description text not null check (length(trim(description)) between 10 and 8000),
  budget_minor bigint check (budget_minor is null or budget_minor >= 0),
  currency text not null default 'NZD' check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'draft' check (status in ('draft','review','open','matched','closed','cancelled')),
  visibility text not null default 'private' check (visibility in ('private','marketplace')),
  state_version bigint not null default 1,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,idempotency_key)
);
create index if not exists marketplace_rfqs_discovery_idx on marketplace.rfqs(silo_id,status,created_at desc) where visibility='marketplace' and status='open';

create table if not exists marketplace.proposals (
  id uuid primary key,
  rfq_id uuid not null references marketplace.rfqs(id) on delete cascade,
  seller_organization_id uuid not null references marketplace.organizations(id) on delete restrict,
  submitted_by text not null,
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  lead_time_days integer check (lead_time_days is null or lead_time_days >= 0),
  scope text not null check (length(trim(scope)) between 10 and 8000),
  status text not null default 'draft' check (status in ('draft','submitted','shortlisted','accepted','rejected','withdrawn')),
  state_version bigint not null default 1,
  idempotency_key text not null,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (seller_organization_id,idempotency_key)
);
create index if not exists marketplace_proposals_rfq_idx on marketplace.proposals(rfq_id,status,created_at);
create index if not exists marketplace_proposals_seller_idx on marketplace.proposals(seller_organization_id,status,created_at desc);

create table if not exists marketplace.orders (
  id uuid primary key,
  buyer_organization_id uuid not null references marketplace.organizations(id) on delete restrict,
  seller_organization_id uuid not null references marketplace.organizations(id) on delete restrict,
  listing_id uuid references marketplace.listings(id) on delete restrict,
  proposal_id uuid references marketplace.proposals(id) on delete restrict,
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'checkout_pending' check (status in ('checkout_pending','payment_pending','paid','fulfillment_pending','fulfilled','disputed','refund_pending','refunded','closed')),
  idempotency_key text not null unique,
  payment_provider text,
  provider_checkout_id text unique,
  settlement_evidence jsonb not null default '{}'::jsonb,
  fulfillment_evidence jsonb not null default '{}'::jsonb,
  state_version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((listing_id is not null) <> (proposal_id is not null))
);
create index if not exists marketplace_orders_buyer_idx on marketplace.orders(buyer_organization_id,created_at desc);
create index if not exists marketplace_orders_seller_idx on marketplace.orders(seller_organization_id,created_at desc);

create table if not exists marketplace.council_runs (
  id uuid primary key,
  organization_id uuid not null references marketplace.organizations(id) on delete cascade,
  silo_id text not null,
  entity_type text not null check (entity_type in ('listing','rfq','proposal','offer','fulfillment')),
  entity_id uuid not null,
  schema_version text not null,
  status text not null check (status in ('queued','running','review_proposal','blocked','failed')),
  input_hash text not null check (input_hash ~ '^[0-9a-f]{64}$'),
  output_hash text check (output_hash is null or output_hash ~ '^[0-9a-f]{64}$'),
  model_receipts jsonb not null default '[]'::jsonb,
  unresolved_risks jsonb not null default '[]'::jsonb,
  publish_authorized boolean not null default false check (publish_authorized=false),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists marketplace_council_tenant_idx on marketplace.council_runs(organization_id,created_at desc);

create table if not exists marketplace.public_rfq_intake (
  id uuid primary key,
  idempotency_key text not null unique,
  company text not null check (length(trim(company)) between 2 and 120),
  contact_email text not null check (length(contact_email) <= 254),
  category text not null,
  title text not null check (length(trim(title)) between 5 and 160),
  details text not null check (length(trim(details)) between 10 and 2000),
  budget_text text not null default '' check (length(budget_text) <= 120),
  region text not null,
  contact_consent boolean not null check (contact_consent=true),
  privacy_notice_version text not null,
  status text not null default 'received' check (status in ('received','reviewing','matched','closed','spam')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists marketplace_public_rfq_status_idx on marketplace.public_rfq_intake(status,created_at desc);

create table if not exists marketplace.intake_rate_limits (
  ip_hash text not null,
  window_start timestamptz not null,
  request_count integer not null default 1 check (request_count between 1 and 5),
  primary key (ip_hash,window_start)
);

create table if not exists marketplace.audit_events (
  id uuid primary key,
  organization_id uuid references marketplace.organizations(id) on delete restrict,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  actor_principal_id text,
  previous_hash text,
  event_hash text not null check (event_hash ~ '^[0-9a-f]{64}$'),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists marketplace_audit_entity_idx on marketplace.audit_events(entity_type,entity_id,created_at);

-- RLS context is set per transaction by the Cloudflare Worker. Owner-role access must not be used
-- by browser clients, while the Worker verifies Cloudflare Access JWTs and tenant membership first.
do $$
declare t text;
begin
  foreach t in array array['organizations','memberships','organization_silos','listings','rfqs','proposals','orders','council_runs','public_rfq_intake','intake_rate_limits','audit_events'] loop
    execute format('alter table marketplace.%I enable row level security',t);
  end loop;
end $$;

drop policy if exists organizations_member_read on marketplace.organizations;
create policy organizations_member_read on marketplace.organizations for select using (
  exists (select 1 from marketplace.memberships m where m.organization_id=organizations.id
    and m.principal_id=current_setting('app.principal_id',true) and m.status='active')
);
drop policy if exists organizations_owner_insert on marketplace.organizations;
create policy organizations_owner_insert on marketplace.organizations for insert with check (
  owner_principal_id=current_setting('app.principal_id',true)
);
drop policy if exists memberships_self_read on marketplace.memberships;
create policy memberships_self_read on marketplace.memberships for select using (
  principal_id=current_setting('app.principal_id',true)
);
drop policy if exists memberships_owner_insert on marketplace.memberships;
create policy memberships_owner_insert on marketplace.memberships for insert with check (
  principal_id=current_setting('app.principal_id',true) and role='owner'
  and exists (select 1 from marketplace.organizations o where o.id=organization_id
    and o.owner_principal_id=current_setting('app.principal_id',true))
);
drop policy if exists silos_member_read on marketplace.organization_silos;
create policy silos_member_read on marketplace.organization_silos for select using (
  exists (select 1 from marketplace.memberships m where m.organization_id=organization_silos.organization_id
    and m.principal_id=current_setting('app.principal_id',true) and m.status='active')
);
drop policy if exists listings_public_or_tenant_read on marketplace.listings;
create policy listings_public_or_tenant_read on marketplace.listings for select using (
  status='published' or exists (select 1 from marketplace.memberships m
    where m.organization_id=listings.organization_id and m.principal_id=current_setting('app.principal_id',true) and m.status='active')
);
drop policy if exists listings_tenant_insert on marketplace.listings;
create policy listings_tenant_insert on marketplace.listings for insert with check (
  status='draft' and exists (select 1 from marketplace.memberships m
    where m.organization_id=listings.organization_id and m.principal_id=current_setting('app.principal_id',true)
      and m.status='active' and m.role in ('owner','admin','seller'))
);
drop policy if exists rfqs_public_or_tenant_read on marketplace.rfqs;
create policy rfqs_public_or_tenant_read on marketplace.rfqs for select using (
  (status='open' and visibility='marketplace') or exists (select 1 from marketplace.memberships m
    where m.organization_id=rfqs.organization_id and m.principal_id=current_setting('app.principal_id',true) and m.status='active')
);
drop policy if exists rfqs_tenant_insert on marketplace.rfqs;
create policy rfqs_tenant_insert on marketplace.rfqs for insert with check (
  status='draft' and visibility='private' and requester_principal_id=current_setting('app.principal_id',true)
  and exists (select 1 from marketplace.memberships m where m.organization_id=rfqs.organization_id
    and m.principal_id=current_setting('app.principal_id',true) and m.status='active' and m.role in ('owner','admin','buyer'))
);
drop policy if exists proposals_tenant_read on marketplace.proposals;
create policy proposals_tenant_read on marketplace.proposals for select using (
  exists (select 1 from marketplace.memberships m where m.organization_id=proposals.seller_organization_id
    and m.principal_id=current_setting('app.principal_id',true) and m.status='active')
  or exists (select 1 from marketplace.rfqs r join marketplace.memberships m on m.organization_id=r.organization_id
    where r.id=proposals.rfq_id and m.principal_id=current_setting('app.principal_id',true) and m.status='active')
);
drop policy if exists council_tenant_read on marketplace.council_runs;
create policy council_tenant_read on marketplace.council_runs for select using (
  exists (select 1 from marketplace.memberships m where m.organization_id=council_runs.organization_id
    and m.principal_id=current_setting('app.principal_id',true) and m.status='active')
);
drop policy if exists council_service_insert on marketplace.council_runs;
create policy council_service_insert on marketplace.council_runs for insert with check (
  current_setting('app.actor_type',true)='service' and publish_authorized=false
);
drop policy if exists public_intake_service_insert on marketplace.public_rfq_intake;
create policy public_intake_service_insert on marketplace.public_rfq_intake for insert with check (
  current_setting('app.actor_type',true)='service' and contact_consent=true
);
drop policy if exists intake_rate_service_all on marketplace.intake_rate_limits;
create policy intake_rate_service_all on marketplace.intake_rate_limits for all using (
  current_setting('app.actor_type',true)='service'
) with check (current_setting('app.actor_type',true)='service');

comment on schema marketplace is 'Neon-native DreamLedger B2B marketplace, separate from legacy Supabase schemas.';
comment on table marketplace.public_rfq_intake is 'Private inbound requests. Never exposed as public listings; human review required.';
comment on table marketplace.council_runs is 'Tenant-scoped Figure Eight review receipts. Model output cannot authorize publication or claim revenue.';
