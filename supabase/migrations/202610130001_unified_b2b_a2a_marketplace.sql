-- DreamLedger unified B2B + A2A marketplace transaction kernel.
-- Apply only after inspecting the live schema and testing on a non-production project.
-- One canonical ledger; external payment and delivery evidence are separate facts.
begin;

create extension if not exists pgcrypto;

create table if not exists public.marketplace_parties (
  id uuid primary key default gen_random_uuid(),
  party_type text not null check (party_type in ('business','human','agent')),
  display_name text not null check (length(trim(display_name)) between 2 and 160),
  slug text unique,
  status text not null default 'pending' check (status in ('pending','active','suspended','rejected')),
  legal_name text,
  country_code char(2),
  public_profile jsonb not null default '{}'::jsonb,
  trust_state text not null default 'UNVERIFIED' check (trust_state in ('UNVERIFIED','CLAIMED','EVIDENCE_SUBMITTED','VERIFIED','REVOKED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketplace_agent_principals (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.marketplace_parties(id),
  agent_uri text not null,
  agent_card jsonb not null default '{}'::jsonb,
  principal_party_id uuid not null references public.marketplace_parties(id),
  authority_scope text[] not null default '{}',
  max_spend_minor bigint not null default 0 check (max_spend_minor >= 0),
  currency char(3) not null default 'NZD',
  requires_human_approval boolean not null default true,
  credential_hash text unique,
  status text not null default 'pending' check (status in ('pending','active','revoked')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique(agent_uri, principal_party_id)
);

create table if not exists public.marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  seller_party_id uuid not null references public.marketplace_parties(id),
  listing_type text not null check (listing_type in ('goods','service','digital_work','agent_capability','surplus_lot','rfq')),
  title text not null check (length(trim(title)) between 4 and 180),
  description text not null check (length(trim(description)) between 10 and 12000),
  category text not null,
  price_minor bigint check (price_minor is null or price_minor >= 0),
  currency char(3) not null default 'NZD',
  pricing_model text not null default 'fixed' check (pricing_model in ('fixed','quote','subscription','usage','auction','free')),
  quantity numeric(18,4) check (quantity is null or quantity >= 0),
  unit text,
  location jsonb not null default '{}'::jsonb,
  attributes jsonb not null default '{}'::jsonb,
  evidence_ids uuid[] not null default '{}',
  status text not null default 'draft' check (status in ('draft','pending_review','published','paused','sold','withdrawn','rejected')),
  publication_gate jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists marketplace_listings_search_idx on public.marketplace_listings using gin (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || coalesce(category,'')));
create index if not exists marketplace_listings_live_idx on public.marketplace_listings(status, listing_type, category, created_at desc);

create table if not exists public.marketplace_requirements (
  id uuid primary key default gen_random_uuid(),
  buyer_party_id uuid references public.marketplace_parties(id),
  source_type text not null check (source_type in ('human','agent','imported','system')),
  source_ref text,
  title text not null,
  problem_statement text not null,
  category text not null,
  quantity numeric(18,4),
  unit text,
  budget_min_minor bigint,
  budget_max_minor bigint,
  currency char(3) not null default 'NZD',
  needed_by timestamptz,
  delivery_region jsonb not null default '{}'::jsonb,
  constraints jsonb not null default '{}'::jsonb,
  evidence_ids uuid[] not null default '{}',
  demand_state text not null default 'OBSERVED' check (demand_state in ('OBSERVED','QUALIFIED_BUYER_INTENT','CONTRADICTED','STALE','REJECTED')),
  authorization_state text not null default 'UNAUTHORIZED' check (authorization_state in ('UNAUTHORIZED','AUTHORIZED','REVOKED')),
  status text not null default 'open' check (status in ('draft','open','matching','fulfilled','cancelled','expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (budget_min_minor is null or budget_min_minor >= 0),
  check (budget_max_minor is null or budget_max_minor >= 0),
  check (budget_min_minor is null or budget_max_minor is null or budget_min_minor <= budget_max_minor)
);

create table if not exists public.marketplace_rfqs (
  id uuid primary key default gen_random_uuid(),
  requirement_id uuid not null references public.marketplace_requirements(id),
  buyer_party_id uuid references public.marketplace_parties(id),
  title text not null,
  scope jsonb not null default '{}'::jsonb,
  response_deadline timestamptz,
  status text not null default 'draft' check (status in ('draft','published','closed','awarded','cancelled')),
  published_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists marketplace_rfqs_open_idx on public.marketplace_rfqs(status, response_deadline);

create table if not exists public.marketplace_offers (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid references public.marketplace_rfqs(id),
  listing_id uuid references public.marketplace_listings(id),
  seller_party_id uuid not null references public.marketplace_parties(id),
  buyer_party_id uuid references public.marketplace_parties(id),
  agent_principal_id uuid references public.marketplace_agent_principals(id),
  title text not null,
  scope jsonb not null default '{}'::jsonb,
  amount_minor bigint not null check (amount_minor >= 0),
  currency char(3) not null default 'NZD',
  delivery_terms jsonb not null default '{}'::jsonb,
  validity_until timestamptz,
  evidence_ids uuid[] not null default '{}',
  status text not null default 'draft' check (status in ('draft','submitted','shortlisted','accepted','rejected','withdrawn','expired')),
  created_at timestamptz not null default now()
);
create index if not exists marketplace_offers_rfq_idx on public.marketplace_offers(rfq_id,status,amount_minor);

create table if not exists public.marketplace_agreements (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.marketplace_offers(id),
  buyer_party_id uuid not null references public.marketplace_parties(id),
  seller_party_id uuid not null references public.marketplace_parties(id),
  version integer not null default 1,
  terms jsonb not null,
  terms_hash text not null,
  buyer_accepted_at timestamptz,
  seller_accepted_at timestamptz,
  human_authorization jsonb not null default '{}'::jsonb,
  status text not null default 'proposed' check (status in ('proposed','accepted','cancelled','completed','disputed')),
  created_at timestamptz not null default now(),
  unique(offer_id, version)
);

create table if not exists public.marketplace_orders (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid references public.marketplace_agreements(id),
  buyer_party_id uuid not null references public.marketplace_parties(id),
  seller_party_id uuid not null references public.marketplace_parties(id),
  amount_minor bigint not null check (amount_minor >= 0),
  currency char(3) not null default 'NZD',
  payment_provider text,
  payment_reference text,
  payment_state text not null default 'UNPAID' check (payment_state in ('UNPAID','PENDING','SETTLED','REFUNDED','DISPUTED','FAILED')),
  fulfillment_state text not null default 'NOT_STARTED' check (fulfillment_state in ('NOT_STARTED','IN_PROGRESS','DELIVERED','ACCEPTED','REJECTED','DISPUTED')),
  idempotency_key text not null unique,
  state text not null default 'CREATED' check (state in ('CREATED','AUTHORIZED','PAYMENT_PENDING','PAID','FULFILLING','DELIVERED','ACCEPTED','CANCELLED','DISPUTED','REFUNDED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists marketplace_payment_reference_unique on public.marketplace_orders(payment_provider,payment_reference) where payment_reference is not null;
create index if not exists marketplace_orders_buyer_idx on public.marketplace_orders(buyer_party_id,created_at desc);
create index if not exists marketplace_orders_seller_idx on public.marketplace_orders(seller_party_id,created_at desc);

create table if not exists public.marketplace_fulfillments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.marketplace_orders(id),
  fulfillment_type text not null,
  promised_at timestamptz,
  delivered_at timestamptz,
  accepted_at timestamptz,
  deliverable_manifest jsonb not null default '{}'::jsonb,
  evidence_ids uuid[] not null default '{}',
  status text not null default 'queued' check (status in ('queued','in_progress','delivered','accepted','rejected','disputed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketplace_evidence (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null,
  subject_id uuid,
  evidence_type text not null,
  source_uri text,
  source_hash text,
  content_hash text not null,
  observed_at timestamptz not null default now(),
  expires_at timestamptz,
  provenance jsonb not null default '{}'::jsonb,
  verdict text not null default 'UNVERIFIED' check (verdict in ('VERIFIED','UNVERIFIED','CONTRADICTED','STALE','TEST','SIMULATED','INTERNAL','UNMATCHED')),
  verifier text,
  created_at timestamptz not null default now(),
  unique(content_hash, subject_type, subject_id)
);

create table if not exists public.marketplace_disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.marketplace_orders(id),
  opened_by uuid not null references public.marketplace_parties(id),
  reason_code text not null,
  statement text not null,
  evidence_ids uuid[] not null default '{}',
  resolution text,
  status text not null default 'open' check (status in ('open','investigating','resolved_buyer','resolved_seller','withdrawn')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.marketplace_ledger_events (
  sequence_id bigint generated always as identity primary key,
  event_id uuid not null default gen_random_uuid() unique,
  idempotency_key text not null unique,
  event_type text not null,
  subject_type text not null,
  subject_id uuid,
  actor_type text not null check (actor_type in ('human','business','agent','system','stripe','verifier')),
  actor_id text,
  economic_state text not null default 'OBSERVED' check (economic_state in ('OBSERVED','QUALIFIED_BUYER_INTENT','AUTHORIZED','PAYMENT_PENDING','SETTLED','FULFILLED','DELIVERED','ACCEPTED','REFUNDED','DISPUTED','VERIFIED','CONTRADICTED','STALE','TEST','SIMULATED','INTERNAL','UNMATCHED')),
  payload jsonb not null default '{}'::jsonb,
  evidence_ids uuid[] not null default '{}',
  previous_hash text,
  event_hash text not null,
  occurred_at timestamptz not null default now(),
  recorded_at timestamptz not null default now()
);
create index if not exists marketplace_ledger_subject_idx on public.marketplace_ledger_events(subject_type,subject_id,sequence_id);
create index if not exists marketplace_ledger_state_idx on public.marketplace_ledger_events(economic_state,sequence_id desc);

create table if not exists public.marketplace_idempotency (
  idempotency_key text primary key,
  request_hash text not null,
  response_body jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.marketplace_agent_approvals (
  id uuid primary key default gen_random_uuid(),
  agent_principal_id uuid not null references public.marketplace_agent_principals(id),
  action text not null,
  amount_minor bigint not null default 0 check (amount_minor >= 0),
  currency char(3) not null default 'NZD',
  request_hash text not null,
  approval_token_hash text unique,
  approved_by text,
  approved_at timestamptz,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  status text not null default 'pending' check (status in ('pending','approved','rejected','expired','consumed')),
  created_at timestamptz not null default now()
);

create table if not exists public.marketplace_webhook_inbox (
  provider text not null,
  event_id text not null,
  event_type text not null,
  payload_hash text not null,
  payload jsonb not null default '{}'::jsonb,
  processing_state text not null default 'received' check (processing_state in ('received','processing','processed','retry','dead_letter')),
  attempt_count integer not null default 0,
  last_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  primary key(provider,event_id)
);

create table if not exists public.marketplace_cube_hypotheses (
  id text primary key,
  buyer_segment text not null,
  problem_statement text not null,
  offer_hypothesis text not null,
  price_minor bigint,
  currency char(3) not null default 'NZD',
  fulfillment_contract jsonb not null default '{}'::jsonb,
  evidence_required jsonb not null default '{}'::jsonb,
  candidate_silo text not null,
  priority text not null check (priority in ('P1','P2','P3')),
  state text not null default 'HYPOTHESIS_UNVALIDATED' check (state in ('HYPOTHESIS_UNVALIDATED','OBSERVED_PROBLEM','QUALIFIED_BUYER_INTENT','GATED','READY','LIVE','TRANSACTING','VERIFIED','KILLED')),
  source_evidence_ids uuid[] not null default '{}',
  kill_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS defaults closed. Service role performs server-side writes. Public access is via API/RPC only.
alter table public.marketplace_parties enable row level security;
alter table public.marketplace_agent_principals enable row level security;
alter table public.marketplace_listings enable row level security;
alter table public.marketplace_requirements enable row level security;
alter table public.marketplace_rfqs enable row level security;
alter table public.marketplace_offers enable row level security;
alter table public.marketplace_agreements enable row level security;
alter table public.marketplace_orders enable row level security;
alter table public.marketplace_fulfillments enable row level security;
alter table public.marketplace_evidence enable row level security;
alter table public.marketplace_disputes enable row level security;
alter table public.marketplace_ledger_events enable row level security;
alter table public.marketplace_idempotency enable row level security;
alter table public.marketplace_agent_approvals enable row level security;
alter table public.marketplace_webhook_inbox enable row level security;
alter table public.marketplace_cube_hypotheses enable row level security;

revoke all on public.marketplace_parties, public.marketplace_agent_principals, public.marketplace_listings, public.marketplace_requirements, public.marketplace_rfqs, public.marketplace_offers, public.marketplace_agreements, public.marketplace_orders, public.marketplace_fulfillments, public.marketplace_evidence, public.marketplace_disputes, public.marketplace_ledger_events, public.marketplace_idempotency, public.marketplace_agent_approvals, public.marketplace_webhook_inbox, public.marketplace_cube_hypotheses from anon, authenticated;
grant select,insert,update,delete on public.marketplace_parties, public.marketplace_agent_principals, public.marketplace_listings, public.marketplace_requirements, public.marketplace_rfqs, public.marketplace_offers, public.marketplace_agreements, public.marketplace_orders, public.marketplace_fulfillments, public.marketplace_evidence, public.marketplace_disputes, public.marketplace_ledger_events, public.marketplace_idempotency, public.marketplace_agent_approvals, public.marketplace_webhook_inbox, public.marketplace_cube_hypotheses to service_role;

create or replace function public.marketplace_append_ledger_event(
  p_idempotency_key text, p_event_type text, p_subject_type text, p_subject_id uuid,
  p_actor_type text, p_actor_id text, p_economic_state text, p_payload jsonb default '{}'::jsonb,
  p_evidence_ids uuid[] default '{}'::uuid[]
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  prior public.marketplace_ledger_events%rowtype;
  previous text;
  new_hash text;
  result public.marketplace_ledger_events%rowtype;
  canonical jsonb;
begin
  if coalesce(length(trim(p_idempotency_key)),0)<8 then raise exception 'idempotency key must be at least 8 chars'; end if;
  select * into prior from public.marketplace_ledger_events where idempotency_key=p_idempotency_key;
  if found then return jsonb_build_object('duplicate',true,'event_id',prior.event_id,'sequence_id',prior.sequence_id,'event_hash',prior.event_hash); end if;
  select event_hash into previous from public.marketplace_ledger_events order by sequence_id desc limit 1;
  canonical := jsonb_build_object('idempotency_key',p_idempotency_key,'event_type',p_event_type,'subject_type',p_subject_type,'subject_id',p_subject_id,'actor_type',p_actor_type,'actor_id',p_actor_id,'economic_state',p_economic_state,'payload',coalesce(p_payload,'{}'::jsonb),'evidence_ids',to_jsonb(coalesce(p_evidence_ids,'{}'::uuid[])),'previous_hash',previous);
  new_hash := encode(digest(convert_to(canonical::text,'UTF8'),'sha256'),'hex');
  insert into public.marketplace_ledger_events(idempotency_key,event_type,subject_type,subject_id,actor_type,actor_id,economic_state,payload,evidence_ids,previous_hash,event_hash)
  values(p_idempotency_key,p_event_type,p_subject_type,p_subject_id,p_actor_type,p_actor_id,p_economic_state,coalesce(p_payload,'{}'::jsonb),coalesce(p_evidence_ids,'{}'::uuid[]),previous,new_hash)
  on conflict(idempotency_key) do nothing returning * into result;
  if result.event_id is null then
    select * into result from public.marketplace_ledger_events where idempotency_key=p_idempotency_key;
    return jsonb_build_object('duplicate',true,'event_id',result.event_id,'sequence_id',result.sequence_id,'event_hash',result.event_hash);
  end if;
  return jsonb_build_object('duplicate',false,'event_id',result.event_id,'sequence_id',result.sequence_id,'event_hash',result.event_hash);
end; $$;

create or replace function public.marketplace_create_public_rfq(
  p_idempotency_key text, p_title text, p_problem text, p_category text, p_budget_min_minor bigint default null,
  p_budget_max_minor bigint default null, p_currency char(3) default 'NZD', p_needed_by timestamptz default null,
  p_region jsonb default '{}'::jsonb, p_constraints jsonb default '{}'::jsonb, p_source_ref text default null
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare req public.marketplace_requirements%rowtype; rfq public.marketplace_rfqs%rowtype; prior jsonb;
begin
  if length(trim(coalesce(p_title,''))) not between 4 and 180 then raise exception 'title must be 4-180 characters'; end if;
  if length(trim(coalesce(p_problem,''))) not between 10 and 5000 then raise exception 'problem must be 10-5000 characters'; end if;
  if length(trim(coalesce(p_category,''))) not between 2 and 80 then raise exception 'category required'; end if;
  if coalesce(length(trim(p_idempotency_key)),0)<12 then raise exception 'idempotency key must be at least 12 chars'; end if;
  select response_body into prior from public.marketplace_idempotency where idempotency_key=p_idempotency_key;
  if found then return prior || jsonb_build_object('duplicate',true); end if;
  insert into public.marketplace_requirements(source_type,source_ref,title,problem_statement,category,budget_min_minor,budget_max_minor,currency,needed_by,delivery_region,constraints,demand_state,authorization_state,status)
  values('human',left(coalesce(p_source_ref,''),500),trim(p_title),trim(p_problem),lower(trim(p_category)),p_budget_min_minor,p_budget_max_minor,upper(coalesce(p_currency,'NZD')),p_needed_by,coalesce(p_region,'{}'::jsonb),coalesce(p_constraints,'{}'::jsonb),'OBSERVED','UNAUTHORIZED','open') returning * into req;
  insert into public.marketplace_rfqs(requirement_id,title,scope,status,published_at)
  values(req.id,req.title,jsonb_build_object('problem',req.problem_statement,'category',req.category,'region',req.delivery_region,'constraints',req.constraints),'published',now()) returning * into rfq;
  perform public.marketplace_append_ledger_event(p_idempotency_key||':observed','RFQ_SUBMITTED','rfq',rfq.id,'human',null,'OBSERVED',jsonb_build_object('requirement_id',req.id,'source_ref',req.source_ref,'budget_min_minor',req.budget_min_minor,'budget_max_minor',req.budget_max_minor));
  insert into public.marketplace_idempotency(idempotency_key,request_hash,response_body)
  values(p_idempotency_key,encode(digest(convert_to(jsonb_build_object('title',p_title,'problem',p_problem,'category',p_category,'budget_min_minor',p_budget_min_minor,'budget_max_minor',p_budget_max_minor)::text,'UTF8'),'sha256'),'hex'),jsonb_build_object('rfq_id',rfq.id,'requirement_id',req.id,'state','OBSERVED','message','RFQ received for review; supplier responses are not guaranteed'));
  return jsonb_build_object('rfq_id',rfq.id,'requirement_id',req.id,'state','OBSERVED','message','RFQ received for review; supplier responses are not guaranteed','duplicate',false);
end; $$;

create or replace function public.marketplace_public_listings(p_query text default '', p_category text default null, p_listing_type text default null, p_limit integer default 24, p_offset integer default 0)
returns setof jsonb language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object('id',l.id,'seller_party_id',l.seller_party_id,'listing_type',l.listing_type,'title',l.title,'description',l.description,'category',l.category,'price_minor',l.price_minor,'currency',l.currency,'pricing_model',l.pricing_model,'quantity',l.quantity,'unit',l.unit,'location',l.location,'attributes',l.attributes,'created_at',l.created_at)
  from public.marketplace_listings l join public.marketplace_parties p on p.id=l.seller_party_id
  where l.status='published' and p.status='active'
    and (coalesce(trim(p_query),'')='' or to_tsvector('simple',l.title||' '||l.description||' '||l.category) @@ plainto_tsquery('simple',p_query))
    and (p_category is null or l.category=lower(p_category))
    and (p_listing_type is null or l.listing_type=p_listing_type)
  order by l.created_at desc limit least(greatest(coalesce(p_limit,24),1),100) offset greatest(coalesce(p_offset,0),0);
$$;

create or replace function public.marketplace_record_agent_intent(
  p_idempotency_key text,p_agent_uri text,p_principal_party_id uuid,p_action text,p_request jsonb,p_spend_minor bigint default 0,p_currency char(3) default 'NZD'
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare principal public.marketplace_agent_principals%rowtype; request_hash text; approval public.marketplace_agent_approvals%rowtype; result jsonb;
begin
  select * into principal from public.marketplace_agent_principals where agent_uri=p_agent_uri and principal_party_id=p_principal_party_id and status='active' and (expires_at is null or expires_at>now()) for update;
  if not found then raise exception 'agent principal is not active or not authorized'; end if;
  if not (p_action = any(principal.authority_scope)) then raise exception 'action outside principal authority scope'; end if;
  if p_spend_minor<0 or p_spend_minor>principal.max_spend_minor then raise exception 'spend exceeds principal limit'; end if;
  request_hash:=encode(digest(convert_to(coalesce(p_request,'{}'::jsonb)::text,'UTF8'),'sha256'),'hex');
  insert into public.marketplace_agent_approvals(agent_principal_id,action,amount_minor,currency,request_hash,expires_at,status)
  values(principal.id,p_action,p_spend_minor,upper(p_currency),request_hash,now()+interval '15 minutes','pending') returning * into approval;
  perform public.marketplace_append_ledger_event(p_idempotency_key,'A2A_INTENT_RECORDED','agent_approval',approval.id,'agent',p_agent_uri,'OBSERVED',jsonb_build_object('action',p_action,'request_hash',request_hash,'spend_minor',p_spend_minor,'currency',upper(p_currency),'human_approval_required',principal.requires_human_approval or p_spend_minor>0));
  result:=jsonb_build_object('approval_id',approval.id,'state','PENDING_HUMAN_APPROVAL','request_hash',request_hash,'expires_at',approval.expires_at,'execution_authorized',false);
  return result;
end; $$;

revoke all on function public.marketplace_append_ledger_event(text,text,text,uuid,text,text,text,jsonb,uuid[]) from public,anon,authenticated;
revoke all on function public.marketplace_create_public_rfq(text,text,text,text,bigint,bigint,char,timestamptz,jsonb,jsonb,text) from public,anon,authenticated;
revoke all on function public.marketplace_public_listings(text,text,text,integer,integer) from public,anon,authenticated;
revoke all on function public.marketplace_record_agent_intent(text,text,uuid,text,jsonb,bigint,char) from public,anon,authenticated;
grant execute on function public.marketplace_append_ledger_event(text,text,text,uuid,text,text,text,jsonb,uuid[]) to service_role;
grant execute on function public.marketplace_create_public_rfq(text,text,text,text,bigint,bigint,char,timestamptz,jsonb,jsonb,text) to service_role;
grant execute on function public.marketplace_public_listings(text,text,text,integer,integer) to service_role;
grant execute on function public.marketplace_record_agent_intent(text,text,uuid,text,jsonb,bigint,char) to service_role;

commit;
