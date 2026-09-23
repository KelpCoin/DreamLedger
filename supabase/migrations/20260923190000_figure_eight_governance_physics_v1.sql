-- Figure Eight Governance Physics v1
-- Private substrate. No public Data API exposure.
create schema if not exists figure_eight;

create table if not exists figure_eight.policies (
  policy_id text primary key,
  version text not null,
  active boolean not null default true,
  policy_type text not null,
  body jsonb not null,
  content_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists figure_eight.events (
  event_id uuid primary key default gen_random_uuid(),
  cell_id uuid,
  event_type text not null,
  state_from text,
  state_to text,
  actor text not null,
  payload jsonb not null default '{}'::jsonb,
  content_hash text not null,
  previous_hash text,
  sequence bigint not null,
  created_at timestamptz not null default now(),
  unique(cell_id, sequence)
);

create table if not exists figure_eight.fossils (
  fossil_id uuid primary key default gen_random_uuid(),
  fossil_type text not null check (fossil_type in ('OBSERVATION','DERIVED','DECISION','EVIDENCE','CANON','INVARIANT','OPEN_QUESTION','ECONOMIC_OUTCOME')),
  silo_id text not null,
  contributor text not null,
  observed_at timestamptz not null,
  provenance text not null check (provenance in ('OBSERVED','DERIVED','ASSERTED')),
  status text not null default 'PROPOSED' check (status in ('PROPOSED','PROMOTED','SUPERSEDED','REJECTED','DEMOTED')),
  trust_state text not null default 'QUARANTINE' check (trust_state in ('CLEAN','QUARANTINE','PROHIBITED')),
  confidence numeric(6,5) not null default 0 check (confidence >= 0 and confidence <= 1),
  source_trust numeric(6,5) not null default 0 check (source_trust >= 0 and source_trust <= 1),
  source_id text,
  source_ref text,
  content jsonb not null default '{}'::jsonb,
  content_hash text not null unique,
  previous_hash text,
  sequence bigint not null,
  parent_fossils uuid[] not null default '{}'::uuid[],
  valid_from timestamptz,
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  expired_at timestamptz
);

create unique index if not exists fossils_silo_sequence_uq on figure_eight.fossils(silo_id, sequence);
create index if not exists fossils_active_idx on figure_eight.fossils(silo_id, fossil_type, status, trust_state);
create index if not exists fossils_valid_idx on figure_eight.fossils(valid_from, valid_until);

create table if not exists figure_eight.promotion_events (
  promotion_event_id text primary key,
  fossil_id uuid not null references figure_eight.fossils(fossil_id),
  actor text not null,
  actor_role text not null check (actor_role in ('system','worker','operator')),
  promoted_at timestamptz not null default now(),
  evidence_refs uuid[] not null default '{}'::uuid[],
  effective_independent_source_count integer not null default 0,
  mean_confidence numeric(6,5) not null default 0,
  mean_source_trust numeric(6,5) not null default 0,
  reason text not null,
  prior_state text not null,
  target_state text not null,
  content_hash text not null,
  previous_hash text,
  sequence bigint not null,
  created_at timestamptz not null default now(),
  unique(fossil_id, content_hash)
);

create table if not exists figure_eight.dependency_edges (
  child_fossil_id uuid not null references figure_eight.fossils(fossil_id),
  parent_fossil_id uuid not null references figure_eight.fossils(fossil_id),
  relationship text not null,
  created_at timestamptz not null default now(),
  primary key(child_fossil_id, parent_fossil_id, relationship),
  check(child_fossil_id <> parent_fossil_id)
);

create table if not exists figure_eight.approvals (
  approval_id uuid primary key default gen_random_uuid(),
  action_id uuid,
  action_type text not null,
  action_payload jsonb not null,
  requested_at timestamptz not null default now(),
  requested_by text not null,
  status text not null default 'PENDING' check(status in ('PENDING','APPROVED','REJECTED','EXPIRED')),
  resolved_at timestamptz,
  resolved_by text,
  resolution_note text,
  approval_hash text not null unique
);

create unique index if not exists one_pending_action_approval
on figure_eight.approvals(action_id)
where status = 'PENDING' and action_id is not null;

create table if not exists figure_eight.budget_reservations (
  reservation_id uuid primary key default gen_random_uuid(),
  action_id uuid not null,
  requested_amount_nzd numeric(18,2) not null check(requested_amount_nzd >= 0),
  committed_amount_nzd numeric(18,2) not null default 0 check(committed_amount_nzd >= 0),
  status text not null default 'RESERVED' check(status in ('RESERVED','COMMITTED','REFUNDED','EXPIRED')),
  reserved_at timestamptz not null default now(),
  committed_at timestamptz,
  refunded_at timestamptz,
  idempotency_key text not null unique
);

create table if not exists figure_eight.execution_receipts (
  receipt_id uuid primary key default gen_random_uuid(),
  action_id uuid not null,
  actor text not null,
  actuator_id text not null,
  delegated_by text,
  tool_name text not null,
  request_hash text not null,
  response_hash text,
  external_reference text,
  authorization_hash text not null,
  receipt_hash text not null unique,
  signature text,
  signed_by text,
  executed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists figure_eight.mechanisms (
  mechanism_id uuid primary key default gen_random_uuid(),
  name text not null,
  source_rev_fossil_id uuid not null references figure_eight.fossils(fossil_id),
  status text not null default 'CANDIDATE' check(status in ('CANDIDATE','VERIFIED','DEMOTED','RETIRED')),
  stability_score numeric(6,5) check(stability_score between 0 and 1),
  integrity_score numeric(6,5) check(integrity_score between 0 and 1),
  welfare_score numeric(6,5) check(welfare_score between 0 and 1),
  profitability_score numeric(6,5) check(profitability_score between 0 and 1),
  eas numeric(6,5),
  conditions jsonb not null default '{}'::jsonb,
  proof_refs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists figure_eight.capabilities (
  capability_key text primary key,
  silo_id text not null,
  autonomy_level integer not null default 0 check(autonomy_level between 0 and 3),
  successful_runs integer not null default 0,
  decisive_runs integer not null default 0,
  acceptance_rate numeric(6,5) not null default 0,
  required_approvals integer not null default 0,
  unauthorized_events integer not null default 0,
  last_promotion_at timestamptz,
  cooldown_until timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists figure_eight.rate_limits (
  subject_key text primary key,
  max_writes_hour integer not null default 20,
  max_writes_day integer not null default 100,
  window_started_at timestamptz not null default now(),
  writes_hour integer not null default 0,
  writes_day integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists figure_eight.verification_relationships (
  verifier text not null,
  subject text not null,
  verification_count integer not null default 0,
  last_verified_at timestamptz,
  suspicious boolean not null default false,
  primary key(verifier, subject),
  check(verifier <> subject)
);

create table if not exists figure_eight.demotion_events (
  demotion_id uuid primary key default gen_random_uuid(),
  subject_key text not null,
  capability_key text,
  trigger_type text not null,
  prior_level integer not null,
  target_level integer not null,
  reason text not null,
  cooldown_until timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists figure_eight.seo_opportunities (
  seo_opportunity_id uuid primary key default gen_random_uuid(),
  silo_id text not null,
  source_fossil_id uuid references figure_eight.fossils(fossil_id),
  query_text text not null,
  intent_type text not null check(intent_type in ('COMMERCIAL','TRANSACTIONAL','INFORMATIONAL','NAVIGATIONAL')),
  demand_evidence jsonb not null default '{}'::jsonb,
  evidence_status text not null default 'UNVERIFIED' check(evidence_status in ('VERIFIED','UNVERIFIED','CONTRADICTED','STALE')),
  source_count integer not null default 0,
  independent_source_count integer not null default 0,
  content_brief jsonb not null default '{}'::jsonb,
  release_status text not null default 'HELD' check(release_status in ('HELD','READY','APPROVED','PUBLISHED','RETIRED')),
  canonical_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists seo_opportunity_key
on figure_eight.seo_opportunities(silo_id, lower(query_text));

create table if not exists figure_eight.seo_pages (
  seo_page_id uuid primary key default gen_random_uuid(),
  seo_opportunity_id uuid not null references figure_eight.seo_opportunities(seo_opportunity_id),
  slug text not null unique,
  title text not null,
  meta_description text not null,
  canonical_url text not null,
  body_hash text not null,
  schema_jsonld jsonb not null default '{}'::jsonb,
  internal_links jsonb not null default '[]'::jsonb,
  source_refs jsonb not null default '[]'::jsonb,
  last_reviewed_at timestamptz,
  published_at timestamptz,
  status text not null default 'DRAFT' check(status in ('DRAFT','APPROVED','PUBLISHED','RETIRED')),
  created_at timestamptz not null default now()
);

create table if not exists figure_eight.seo_events (
  seo_event_id uuid primary key default gen_random_uuid(),
  seo_page_id uuid references figure_eight.seo_pages(seo_page_id),
  event_type text not null,
  actor text not null,
  payload jsonb not null default '{}'::jsonb,
  content_hash text not null unique,
  previous_hash text,
  created_at timestamptz not null default now()
);

-- Policy is data, not code.
insert into figure_eight.policies(policy_id,version,policy_type,body,content_hash)
values
('promotion_gate','v1','PROMOTION_GATE','{"belief_min_evidence":3,"belief_min_confidence":0.60,"value_min_evidence":5,"value_requires_protection":true,"min_distinct_queries":3,"min_use_days":2,"min_use_span_hours":24,"min_promotion_score":0.75}'::jsonb,'FIGURE_EIGHT_POLICY_PROMOTION_V1'),
('release_gate','v1','RELEASE_GATE','{"predicates":["certification","effect_typing","impact_classification","risk_vector_admissibility","authority_coverage","goal_commitment","memory_release","federation_provenance","mutation_chain_validity","recovery_mode","liability_receipt","trusted_base_validity","history_clearance","consistency"]}'::jsonb,'FIGURE_EIGHT_POLICY_RELEASE_V1'),
('economic_truth','v1','ECONOMIC_TRUTH','{"verified_status":"VERIFIED","required":["external_buyer","settled_payment","attribution","fulfillment","independent_verification"],"rejected":["SIMULATED","TEST","INTERNAL","UNMATCHED","UNVERIFIED","CONTRADICTED","STALE"]}'::jsonb,'FIGURE_EIGHT_POLICY_ECONOMIC_V1'),
('seo','v1','SEO_GOVERNANCE','{"no_fabricated_search_volume":true,"no_fabricated_prices":true,"source_required":true,"supersession_required":true,"human_approval_for_publish":true,"commercial_pages_require_release_gate":true,"internal_link_evidence_required":true}'::jsonb,'FIGURE_EIGHT_POLICY_SEO_V1')
on conflict(policy_id) do update set version=excluded.version, body=excluded.body, content_hash=excluded.content_hash, active=true;

create or replace function figure_eight.compute_eas(
  p_stability numeric,
  p_integrity numeric,
  p_welfare numeric,
  p_profitability numeric
) returns numeric
language sql immutable
as $$
  select round(((coalesce(p_stability,0)+coalesce(p_integrity,0)+coalesce(p_welfare,0)+coalesce(p_profitability,0))/4.0)::numeric,5)
$$;

create or replace function figure_eight.memory_envelope(p_fossil_id uuid)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'memory_data_begin', true,
    'authority','STORED_DATA',
    'instruction_authority','NONE',
    'execution_authority','NONE',
    'promotion_state', f.status,
    'trust_state', f.trust_state,
    'provenance', f.provenance,
    'source', f.source_ref,
    'source_id', f.source_id,
    'observed_at', f.observed_at,
    'valid_from', f.valid_from,
    'valid_until', f.valid_until,
    'content_hash', f.content_hash,
    'epistemic_status', f.status,
    'payload', f.content,
    'memory_data_end', true
  )
  from figure_eight.fossils f
  where f.fossil_id = p_fossil_id
    and f.trust_state <> 'PROHIBITED'
    and not exists (
      select 1 from figure_eight.fossils s
      where s.silo_id=f.silo_id
        and s.fossil_type=f.fossil_type
        and s.status='SUPERSEDED'
        and s.content->>'supersedes' = f.fossil_id::text
    )
$$;

create or replace function figure_eight.release_gate(p_action jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  names text[] := array[
    'certification','effect_typing','impact_classification','risk_vector_admissibility',
    'authority_coverage','goal_commitment','memory_release','federation_provenance',
    'mutation_chain_validity','recovery_mode','liability_receipt','trusted_base_validity',
    'history_clearance','consistency'
  ];
  n text;
  failed text[] := '{}';
begin
  foreach n in array names loop
    if coalesce((p_action->'release_attestations'->>n),'') <> 'PASS' then
      failed := array_append(failed,n);
    end if;
  end loop;

  if coalesce(p_action->>'economic_truth_status','UNVERIFIED') = 'VERIFIED'
     and coalesce((p_action->'settlement_adapter'->>'independent_verified'),'false') <> 'true' then
    failed := array_append(failed,'economic_truth_adapter');
  end if;

  return jsonb_build_object(
    'decision',case when cardinality(failed)=0 then 'ALLOW' else 'DENY' end,
    'failed_predicates',to_jsonb(failed),
    'predicate_count',14
  );
end
$$;

create or replace function figure_eight.admit_economic_outcome(p_outcome jsonb)
returns boolean
language plpgsql
stable
as $$
begin
  return
    coalesce(p_outcome->>'truth_status','')='VERIFIED'
    and coalesce((p_outcome->'external_buyer'->>'verified'),'false')='true'
    and coalesce((p_outcome->'settlement'->>'settled'),'false')='true'
    and coalesce((p_outcome->'attribution'->>'verified'),'false')='true'
    and coalesce((p_outcome->'fulfillment'->>'verified'),'false')='true'
    and coalesce((p_outcome->'independent_verification'->>'verified'),'false')='true';
end
$$;

create or replace function figure_eight.write_gate(
  p_worker text,
  p_silo text,
  p_fossil_type text,
  p_provenance text,
  p_confidence numeric,
  p_source_trust numeric
) returns jsonb
language plpgsql
stable
as $$
declare
  r figure_eight.rate_limits%rowtype;
  decision text := 'ALLOW';
  reasons text[] := '{}';
begin
  select * into r from figure_eight.rate_limits where subject_key=p_worker;
  if found then
    if r.writes_hour >= r.max_writes_hour or r.writes_day >= r.max_writes_day then
      decision := 'DENY';
      reasons := array_append(reasons,'RATE_LIMIT');
    end if;
  end if;

  if p_provenance='ASSERTED' and p_fossil_type in ('CANON','INVARIANT','ECONOMIC_OUTCOME') then
    decision := 'DENY';
    reasons := array_append(reasons,'ASSERTED_CONSEQUENTIAL_WRITE');
  end if;

  if p_confidence < 0 or p_confidence > 1 or p_source_trust < 0 or p_source_trust > 1 then
    decision := 'DENY';
    reasons := array_append(reasons,'INVALID_SCORE');
  end if;

  return jsonb_build_object('decision',decision,'reasons',to_jsonb(reasons),'silo',p_silo,'worker',p_worker);
end
$$;

create or replace function figure_eight.record_verification_relationship(
  p_verifier text,
  p_subject text
) returns jsonb
language plpgsql
as $$
declare
  c integer;
  suspicious boolean;
begin
  insert into figure_eight.verification_relationships(verifier,subject,verification_count,last_verified_at)
  values(p_verifier,p_subject,1,now())
  on conflict(verifier,subject) do update
    set verification_count=figure_eight.verification_relationships.verification_count+1,
        last_verified_at=now();
  select verification_count into c from figure_eight.verification_relationships
    where verifier=p_verifier and subject=p_subject;
  suspicious := c >= 10;
  update figure_eight.verification_relationships
    set suspicious=suspicious
    where verifier=p_verifier and subject=p_subject;
  return jsonb_build_object('verification_count',c,'suspicious',suspicious);
end
$$;

create or replace function figure_eight.seo_release_gate(p_opportunity_id uuid)
returns jsonb
language plpgsql
stable
as $$
declare
  o figure_eight.seo_opportunities%rowtype;
  failed text[] := '{}';
begin
  select * into o from figure_eight.seo_opportunities where seo_opportunity_id=p_opportunity_id;
  if not found then return jsonb_build_object('decision','DENY','failed_predicates',jsonb_build_array('OPPORTUNITY_NOT_FOUND')); end if;
  if o.evidence_status <> 'VERIFIED' then failed := array_append(failed,'EVIDENCE_NOT_VERIFIED'); end if;
  if o.independent_source_count < 1 then failed := array_append(failed,'NO_INDEPENDENT_SOURCE'); end if;
  if coalesce(o.query_text,'')='' then failed := array_append(failed,'NO_QUERY'); end if;
  if o.release_status not in ('READY','APPROVED') then failed := array_append(failed,'NOT_RELEASE_READY'); end if;
  return jsonb_build_object('decision',case when cardinality(failed)=0 then 'ALLOW' else 'DENY' end,'failed_predicates',to_jsonb(failed));
end
$$;

-- Keep the governance substrate off the Data API.
revoke all on schema figure_eight from public, anon, authenticated;
grant usage on schema figure_eight to service_role;
grant select, insert, update on all tables in schema figure_eight to service_role;
grant execute on all functions in schema figure_eight to service_role;

alter default privileges for role postgres in schema figure_eight revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema figure_eight revoke all on tables from public, anon, authenticated;

comment on schema figure_eight is 'Private governed runtime for the Figure Eight economic ecosystem. Not a public API surface.';
