-- Figure Eight Runtime Workers v2
-- Additive runtime layer over the existing governance-physics substrate.
-- Private data plane; service-role-only RPC control surface.

create schema if not exists figure_eight;

-- ---------------------------------------------------------------------------
-- Cell state machine
-- ---------------------------------------------------------------------------
create table if not exists figure_eight.economic_cells (
  cell_id uuid primary key default gen_random_uuid(),
  cell_key text not null unique,
  silo_id text not null,
  signal_fossil_id uuid references figure_eight.fossils(fossil_id),
  opportunity_id text,
  state text not null default 'SIGNAL' check (state in (
    'SIGNAL','OPPORTUNITY','PROPOSITION','GAUNTLET_PASS',
    'AWAITING_AUTHORIZATION','AUTHORIZED','ACTION_READY',
    'ACTION_DISPATCHED','AWAITING_EXTERNAL_RESPONSE','EXTERNAL_RESPONSE',
    'SETTLEMENT_PENDING','SETTLED','ATTRIBUTION_VERIFIED',
    'FULFILLMENT_COMPLETE','INDEPENDENTLY_VERIFIED','REV_ATOM',
    'MECHANISM_CANDIDATE','MECHANISM_VERIFIED','REPLICATION_QUEUE'
  )),
  state_evidence jsonb not null default '{}'::jsonb,
  version bigint not null default 1,
  last_transition_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists economic_cells_state_idx
  on figure_eight.economic_cells(state, silo_id, updated_at);

create table if not exists figure_eight.cell_transitions (
  transition_id uuid primary key default gen_random_uuid(),
  cell_id uuid not null references figure_eight.economic_cells(cell_id),
  from_state text not null,
  to_state text not null,
  version_from bigint not null,
  version_to bigint not null,
  evidence jsonb not null default '{}'::jsonb,
  guard_snapshot jsonb not null default '{}'::jsonb,
  actor text not null,
  content_hash text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists cell_transitions_cell_idx
  on figure_eight.cell_transitions(cell_id, created_at);

create table if not exists figure_eight.worker_heartbeats (
  worker_id text primary key,
  last_started_at timestamptz,
  last_finished_at timestamptz,
  last_status text,
  last_error text,
  run_count bigint not null default 0,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Outbox and execution receipts
-- ---------------------------------------------------------------------------
create table if not exists figure_eight.economic_outbox (
  outbox_id uuid primary key default gen_random_uuid(),
  cell_id uuid not null references figure_eight.economic_cells(cell_id),
  action_type text not null,
  action_payload jsonb not null,
  dedup_key text not null unique,
  status text not null default 'PENDING' check (status in ('PENDING','DISPATCHING','DISPATCHED','CONFIRMED','FAILED')),
  attempt_count integer not null default 0,
  external_ref text,
  external_url text,
  last_error text,
  dispatched_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists economic_outbox_status_idx
  on figure_eight.economic_outbox(status, created_at);

create table if not exists figure_eight.reconciliation_events (
  reconciliation_event_id uuid primary key default gen_random_uuid(),
  cell_id uuid not null references figure_eight.economic_cells(cell_id),
  source text not null,
  event_key text not null unique,
  stripe_event_id text,
  checkout_session_id text,
  payment_intent_id text,
  mode text not null,
  verified boolean not null default false,
  observed_at timestamptz not null default now(),
  query_used text,
  raw_response text,
  raw_response_sha256 text,
  facts jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists reconciliation_cell_idx
  on figure_eight.reconciliation_events(cell_id, observed_at);

create table if not exists figure_eight.verification_fossils (
  verification_fossil_id uuid primary key default gen_random_uuid(),
  cell_id uuid not null references figure_eight.economic_cells(cell_id),
  reconciliation_event_id uuid references figure_eight.reconciliation_events(reconciliation_event_id),
  provenance text not null check (provenance in ('OBSERVED','DERIVED')),
  source text not null,
  verdict text not null check (verdict in ('VERIFIED','REJECTED','INCONCLUSIVE')),
  query_used text not null,
  raw_response_sha256 text not null,
  verdict_input jsonb not null,
  content_hash text not null unique,
  created_at timestamptz not null default now(),
  unique(cell_id, raw_response_sha256)
);

create index if not exists verification_fossils_cell_idx
  on figure_eight.verification_fossils(cell_id, created_at);

-- ---------------------------------------------------------------------------
-- Verified economic outcomes, mechanisms, replication
-- ---------------------------------------------------------------------------
create table if not exists figure_eight.rev_atoms (
  rev_atom_id uuid primary key default gen_random_uuid(),
  cell_id uuid not null unique references figure_eight.economic_cells(cell_id),
  truth_status text not null check (truth_status = 'VERIFIED'),
  external_buyer jsonb not null,
  settlement jsonb not null,
  attribution jsonb not null,
  fulfillment jsonb not null,
  independent_verification jsonb not null,
  signal_pattern jsonb not null,
  proposition_pattern jsonb not null,
  proof_pattern jsonb not null,
  content_hash text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists figure_eight.mechanism_candidates (
  mechanism_candidate_id uuid primary key default gen_random_uuid(),
  rev_atom_id uuid not null references figure_eight.rev_atoms(rev_atom_id),
  mechanism_version integer not null default 1,
  name text not null,
  signal_pattern jsonb not null,
  proposition_pattern jsonb not null,
  price_pattern jsonb not null,
  channel_pattern jsonb not null,
  response_pattern jsonb not null,
  fulfillment_pattern jsonb not null,
  proof_pattern jsonb not null,
  conditions jsonb not null default '{}'::jsonb,
  outcome jsonb not null default '{}'::jsonb,
  status text not null default 'CANDIDATE' check (status in ('CANDIDATE','VERIFIED','DEMOTED','RETIRED')),
  content_hash text not null unique,
  created_at timestamptz not null default now(),
  unique(rev_atom_id, mechanism_version)
);

create table if not exists figure_eight.replication_candidates (
  replication_candidate_id uuid primary key default gen_random_uuid(),
  mechanism_id uuid not null references figure_eight.mechanism_candidates(mechanism_candidate_id),
  opportunity_id text not null,
  silo_id text not null,
  match_score numeric(6,5) not null check (match_score between 0 and 1),
  matched_fields jsonb not null default '[]'::jsonb,
  evidence_refs jsonb not null default '[]'::jsonb,
  status text not null default 'QUEUED' check (status in ('QUEUED','GAUNTLET','REJECTED','PROMOTED','EXPIRED')),
  candidate_fingerprint text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists replication_mechanism_idx
  on figure_eight.replication_candidates(mechanism_id, match_score desc);

-- ---------------------------------------------------------------------------
-- Figure Eight crossing: Register <-> Factory
-- ---------------------------------------------------------------------------
create table if not exists figure_eight.sales_events (
  sales_event_id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  event_type text not null check (event_type in ('SALE','REFUND','SOLD_OUT','ADJUSTMENT')),
  sku text not null,
  amount_cents bigint,
  currency text not null default 'nzd',
  channel text,
  stripe_session_id text,
  stripe_payment_intent_id text,
  event_timestamp timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists figure_eight.offer_promotions (
  promotion_id uuid primary key default gen_random_uuid(),
  promotion_key text not null unique,
  proposed_sku text not null,
  title text not null,
  description text,
  price_cents bigint not null check (price_cents > 0),
  currency text not null default 'nzd',
  confidence numeric(6,5) check (confidence between 0 and 1),
  reason text not null,
  provenance jsonb not null default '{}'::jsonb,
  promotion_status text not null default 'PENDING' check (promotion_status in ('PENDING','APPROVED','ACCEPTED','REJECTED','RETIRED')),
  approval_id uuid references figure_eight.approvals(approval_id),
  promoted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists figure_eight.processed_events (
  event_key text primary key,
  source text not null,
  processed_at timestamptz not null default now(),
  payload_sha256 text
);

-- ---------------------------------------------------------------------------
-- SEO: evidence-backed acquisition for humans and machines
-- ---------------------------------------------------------------------------
alter table figure_eight.seo_opportunities
  add column if not exists freshness_at timestamptz,
  add column if not exists target_path text,
  add column if not exists human_outline jsonb not null default '{}'::jsonb,
  add column if not exists machine_summary jsonb not null default '{}'::jsonb,
  add column if not exists source_refs jsonb not null default '[]'::jsonb,
  add column if not exists publication_fingerprint text,
  add column if not exists release_gate_result jsonb not null default '{}'::jsonb;

alter table figure_eight.seo_pages
  add column if not exists intent_type text,
  add column if not exists machine_summary jsonb not null default '{}'::jsonb,
  add column if not exists human_keywords jsonb not null default '[]'::jsonb,
  add column if not exists release_gate_result jsonb not null default '{}'::jsonb,
  add column if not exists publication_fingerprint text;

create table if not exists figure_eight.seo_publication_events (
  seo_publication_event_id uuid primary key default gen_random_uuid(),
  seo_page_id uuid not null references figure_eight.seo_pages(seo_page_id),
  event_type text not null check (event_type in ('DRAFTED','APPROVED','PUBLISHED','RETIRED','SUPERSEDED')),
  actor text not null,
  approval_id uuid references figure_eight.approvals(approval_id),
  canonical_url text not null,
  body_hash text not null,
  machine_hash text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Append-only protection
-- ---------------------------------------------------------------------------
create or replace function figure_eight.reject_append_only_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'FIGURE_EIGHT_APPEND_ONLY: % is append-only', tg_table_name;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'cell_transitions',
    'reconciliation_events',
    'verification_fossils',
    'rev_atoms',
    'sales_events',
    'processed_events',
    'seo_publication_events'
  ] loop
    execute format('drop trigger if exists %I_append_only on figure_eight.%I', t, t);
    execute format(
      'create trigger %I_append_only before update or delete on figure_eight.%I for each row execute function figure_eight.reject_append_only_mutation()',
      t, t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Transition map and CAS transition function
-- ---------------------------------------------------------------------------
create table if not exists figure_eight.transition_edges (
  from_state text not null,
  to_state text not null,
  guard_key text not null,
  primary key(from_state, to_state)
);

insert into figure_eight.transition_edges(from_state,to_state,guard_key)
values
('SIGNAL','OPPORTUNITY','opportunity_id'),
('OPPORTUNITY','PROPOSITION','proposition'),
('PROPOSITION','GAUNTLET_PASS','gauntlet_pass'),
('GAUNTLET_PASS','AWAITING_AUTHORIZATION','approval_request'),
('AWAITING_AUTHORIZATION','AUTHORIZED','approval'),
('AUTHORIZED','ACTION_READY','authorized'),
('ACTION_READY','ACTION_DISPATCHED','outbox_dispatch'),
('ACTION_DISPATCHED','AWAITING_EXTERNAL_RESPONSE','external_wait'),
('AWAITING_EXTERNAL_RESPONSE','EXTERNAL_RESPONSE','external_response'),
('EXTERNAL_RESPONSE','SETTLEMENT_PENDING','settlement_pending'),
('SETTLEMENT_PENDING','SETTLED','settled'),
('SETTLED','ATTRIBUTION_VERIFIED','attribution'),
('ATTRIBUTION_VERIFIED','FULFILLMENT_COMPLETE','fulfillment'),
('FULFILLMENT_COMPLETE','INDEPENDENTLY_VERIFIED','independent_verification'),
('INDEPENDENTLY_VERIFIED','REV_ATOM','rev_atom'),
('REV_ATOM','MECHANISM_CANDIDATE','mechanism_candidate'),
('MECHANISM_CANDIDATE','MECHANISM_VERIFIED','mechanism_verified'),
('MECHANISM_VERIFIED','REPLICATION_QUEUE','replication_queue')
on conflict do nothing;

create or replace function figure_eight.transition_cell(
  p_cell_id uuid,
  p_expected_version bigint,
  p_from_state text,
  p_to_state text,
  p_evidence jsonb,
  p_actor text
)
returns jsonb
language plpgsql
as $$
declare
  c figure_eight.economic_cells%rowtype;
  edge figure_eight.transition_edges%rowtype;
  new_hash text;
  transition_id uuid;
begin
  select * into c from figure_eight.economic_cells where cell_id=p_cell_id for update;
  if not found then
    return jsonb_build_object('ok',false,'reason','CELL_NOT_FOUND');
  end if;
  if c.version <> p_expected_version or c.state <> p_from_state then
    return jsonb_build_object('ok',false,'reason','CAS_MISS','state',c.state,'version',c.version);
  end if;

  select * into edge
    from figure_eight.transition_edges
    where from_state=p_from_state and to_state=p_to_state;
  if not found then
    return jsonb_build_object('ok',false,'reason','EDGE_NOT_ALLOWED');
  end if;

  if edge.guard_key='opportunity_id'
     and coalesce(p_evidence->>'opportunity_id','')='' then
    return jsonb_build_object('ok',false,'reason','MISSING_OPPORTUNITY');
  end if;
  if edge.guard_key='proposition'
     and jsonb_typeof(p_evidence->'proposition') is null then
    return jsonb_build_object('ok',false,'reason','MISSING_PROPOSITION');
  end if;
  if edge.guard_key='gauntlet_pass'
     and coalesce(p_evidence->>'verdict','') <> 'PASS' then
    return jsonb_build_object('ok',false,'reason','GAUNTLET_NOT_PASS');
  end if;
  if edge.guard_key='approval_request'
     and coalesce(p_evidence->>'approval_id','')='' then
    return jsonb_build_object('ok',false,'reason','MISSING_APPROVAL_REQUEST');
  end if;
  if edge.guard_key='approval' then
    if coalesce(p_evidence->>'status','') <> 'APPROVED'
       or lower(coalesce(p_evidence->>'approved_by','')) in ('','system','worker','automation') then
      return jsonb_build_object('ok',false,'reason','HUMAN_APPROVAL_REQUIRED');
    end if;
  end if;
  if edge.guard_key='outbox_dispatch'
     and coalesce(p_evidence->>'outbox_id','')='' then
    return jsonb_build_object('ok',false,'reason','MISSING_OUTBOX_DISPATCH');
  end if;
  if edge.guard_key='external_response'
     and coalesce(p_evidence->>'reconciliation_event_id','')='' then
    return jsonb_build_object('ok',false,'reason','MISSING_EXTERNAL_RESPONSE');
  end if;
  if edge.guard_key='settled' then
    if coalesce(p_evidence->>'mode','') <> 'EXTERNAL_INDEPENDENT_SETTLEMENT'
       or coalesce(p_evidence->>'verified','false') <> 'true' then
      return jsonb_build_object('ok',false,'reason','INDEPENDENT_SETTLEMENT_REQUIRED');
    end if;
  end if;
  if edge.guard_key='attribution'
     and coalesce(p_evidence->>'verified','false') <> 'true' then
    return jsonb_build_object('ok',false,'reason','ATTRIBUTION_UNVERIFIED');
  end if;
  if edge.guard_key='fulfillment'
     and coalesce(p_evidence->>'verified','false') <> 'true' then
    return jsonb_build_object('ok',false,'reason','FULFILLMENT_UNVERIFIED');
  end if;
  if edge.guard_key='independent_verification'
     and coalesce(p_evidence->>'provenance','') <> 'OBSERVED' then
    return jsonb_build_object('ok',false,'reason','OBSERVED_VERIFICATION_REQUIRED');
  end if;
  if edge.guard_key='rev_atom'
     and coalesce(p_evidence->>'truth_status','') <> 'VERIFIED' then
    return jsonb_build_object('ok',false,'reason','VERIFIED_REV_ATOM_REQUIRED');
  end if;
  if edge.guard_key='mechanism_candidate'
     and coalesce(p_evidence->>'mechanism_candidate_id','')='' then
    return jsonb_build_object('ok',false,'reason','MISSING_MECHANISM_CANDIDATE');
  end if;
  if edge.guard_key='mechanism_verified'
     and coalesce(p_evidence->>'status','') <> 'VERIFIED' then
    return jsonb_build_object('ok',false,'reason','MECHANISM_NOT_VERIFIED');
  end if;
  if edge.guard_key='replication_queue'
     and coalesce(p_evidence->>'replication_candidate_count',0)::int < 0 then
    return jsonb_build_object('ok',false,'reason','INVALID_REPLICATION_COUNT');
  end if;

  transition_id := gen_random_uuid();
  new_hash := encode(digest(
    coalesce(c.cell_id::text,'') || '|' ||
    c.version::text || '|' || c.state || '|' || p_to_state || '|' ||
    coalesce(p_evidence::text,'') || '|' || coalesce(p_actor,''),
    'sha256'
  ),'hex');

  update figure_eight.economic_cells
     set state=p_to_state,
         state_evidence=p_evidence,
         version=version+1,
         last_transition_at=now(),
         updated_at=now()
   where cell_id=p_cell_id
     and version=p_expected_version
     and state=p_from_state;

  if not found then
    return jsonb_build_object('ok',false,'reason','CAS_LOST');
  end if;

  insert into figure_eight.cell_transitions(
    transition_id,cell_id,from_state,to_state,version_from,version_to,
    evidence,guard_snapshot,actor,content_hash
  )
  values(
    transition_id,p_cell_id,p_from_state,p_to_state,
    p_expected_version,p_expected_version+1,p_evidence,
    jsonb_build_object('guard_key',edge.guard_key,'validated_at',now()),
    coalesce(p_actor,'unknown'),new_hash
  );

  return jsonb_build_object(
    'ok',true,
    'cell_id',p_cell_id,
    'from_state',p_from_state,
    'to_state',p_to_state,
    'version',p_expected_version+1,
    'transition_id',transition_id,
    'content_hash',new_hash
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Durable worker API. SECURITY INVOKER, service_role only.
-- This is a narrow RPC surface over the private schema.
-- ---------------------------------------------------------------------------
create or replace function public.figure_eight_worker_api(
  p_worker text,
  p_operation text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  c figure_eight.economic_cells%rowtype;
  o figure_eight.economic_outbox%rowtype;
  r figure_eight.reconciliation_events%rowtype;
  v figure_eight.verification_fossils%rowtype;
  rv figure_eight.rev_atoms%rowtype;
  mc figure_eight.mechanism_candidates%rowtype;
  x jsonb;
  arr jsonb := '[]'::jsonb;
  h text;
begin
  if current_user <> 'service_role' then
    raise exception 'FIGURE_EIGHT_AUTH: service_role required';
  end if;

  if p_operation='HEARTBEAT' then
    insert into figure_eight.worker_heartbeats(worker_id,last_started_at,last_status,run_count)
    values(p_worker,now(),'RUNNING',1)
    on conflict(worker_id) do update
      set last_started_at=now(), last_status='RUNNING',
          run_count=figure_eight.worker_heartbeats.run_count+1, updated_at=now();
    return jsonb_build_object('ok',true,'worker',p_worker);
  end if;

  if p_operation='FINISH_HEARTBEAT' then
    update figure_eight.worker_heartbeats
       set last_finished_at=now(),
           last_status=coalesce(p_payload->>'status','PASS'),
           last_error=p_payload->>'error',
           updated_at=now()
     where worker_id=p_worker;
    return jsonb_build_object('ok',true);
  end if;

  if p_operation='CREATE_CELL' then
    if coalesce(p_payload->>'source_fossil_id','')='' or coalesce(p_payload->>'cell_key','')='' then
      raise exception 'CREATE_CELL requires source_fossil_id and cell_key';
    end if;
    insert into figure_eight.economic_cells(
      cell_key,silo_id,signal_fossil_id,opportunity_id,state,state_evidence
    ) values(
      p_payload->>'cell_key',
      coalesce(p_payload->>'silo_id','core'),
      (p_payload->>'source_fossil_id')::uuid,
      p_payload->>'opportunity_id',
      'SIGNAL',
      jsonb_build_object(
        'source_fossil_id',p_payload->>'source_fossil_id',
        'external_source',coalesce(p_payload->>'external_source',''),
        'source_ref',coalesce(p_payload->>'source_ref','')
      )
    )
    on conflict(cell_key) do nothing
    returning * into c;
    if not found then
      select * into c from figure_eight.economic_cells where cell_key=p_payload->>'cell_key';
    end if;
    return jsonb_build_object(
      'ok',true,'cell_id',c.cell_id,'cell_key',c.cell_key,'state',c.state,'version',c.version
    );
  end if;

  if p_operation='CONTROLLER_SCAN' then
    select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) into arr
    from (
      select cell_id,cell_key,silo_id,state,state_evidence,version
      from figure_eight.economic_cells
      where state not in ('REPLICATION_QUEUE')
      order by updated_at
      limit greatest(1,least(100,coalesce((p_payload->>'limit')::int,20)))
    ) q;
    return jsonb_build_object('ok',true,'cells',arr);
  end if;

  if p_operation='CONTROLLER_TRANSITION' then
    return figure_eight.transition_cell(
      (p_payload->>'cell_id')::uuid,
      (p_payload->>'expected_version')::bigint,
      p_payload->>'from_state',
      p_payload->>'to_state',
      coalesce(p_payload->'evidence','{}'::jsonb),
      p_worker
    );
  end if;

  if p_operation='ACTUATOR_CLAIM' then
    select * into c
      from figure_eight.economic_cells
      where state='ACTION_READY'
      order by updated_at
      limit 1
      for update skip locked;
    if not found then
      return jsonb_build_object('ok',true,'idle',true);
    end if;

    insert into figure_eight.economic_outbox(
      cell_id,action_type,action_payload,dedup_key,status
    )
    values(
      c.cell_id,
      coalesce(c.state_evidence->'action'->>'type','OPEN_STRIPE_CHECKOUT'),
      coalesce(c.state_evidence->'action','{}'::jsonb),
      c.cell_id::text || ':' || coalesce(c.state_evidence->'action'->>'type','OPEN_STRIPE_CHECKOUT'),
      'PENDING'
    )
    on conflict(dedup_key) do nothing;

    select * into o
      from figure_eight.economic_outbox
      where cell_id=c.cell_id
      order by created_at desc
      limit 1;

    return jsonb_build_object(
      'ok',true,'idle',false,'cell',to_jsonb(c),'outbox',to_jsonb(o)
    );
  end if;

  if p_operation='ACTUATOR_MARK_DISPATCHED' then
    update figure_eight.economic_outbox
       set status='DISPATCHED',
           attempt_count=attempt_count+1,
           external_ref=p_payload->>'external_ref',
           external_url=p_payload->>'external_url',
           last_error=null,
           dispatched_at=coalesce(dispatched_at,now()),
           updated_at=now()
     where outbox_id=(p_payload->>'outbox_id')::uuid
     returning * into o;
    if not found then raise exception 'OUTBOX_NOT_FOUND'; end if;

    insert into figure_eight.execution_receipts(
      action_id,actor,actuator_id,delegated_by,tool_name,request_hash,
      response_hash,external_reference,authorization_hash,receipt_hash,
      signed_by,executed_at
    )
    values(
      o.outbox_id,p_worker,p_worker,p_payload->>'delegated_by',
      'stripe.checkout.sessions.create',
      p_payload->>'request_hash',
      p_payload->>'response_hash',
      p_payload->>'external_ref',
      p_payload->>'authorization_hash',
      encode(digest(
        coalesce(o.outbox_id::text,'')||'|'||coalesce(p_payload->>'response_hash',''),
        'sha256'),'hex'
      ),
      p_worker,now()
    )
    on conflict(receipt_hash) do nothing;

    return jsonb_build_object('ok',true,'outbox',to_jsonb(o));
  end if;

  if p_operation='ACTUATOR_MARK_FAILED' then
    update figure_eight.economic_outbox
       set status='FAILED', last_error=p_payload->>'error',
           attempt_count=attempt_count+1, updated_at=now()
     where outbox_id=(p_payload->>'outbox_id')::uuid
     returning * into o;
    if not found then raise exception 'OUTBOX_NOT_FOUND'; end if;
    return jsonb_build_object('ok',true,'outbox',to_jsonb(o));
  end if;

  if p_operation='RECONCILER_CANDIDATES' then
    select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) into arr
    from (
      select c.cell_id,c.cell_key,c.version,c.state,
             c.state_evidence,
             o.outbox_id,o.external_ref,
             o.action_payload
      from figure_eight.economic_cells c
      join figure_eight.economic_outbox o on o.cell_id=c.cell_id
      where c.state in ('ACTION_DISPATCHED','AWAITING_EXTERNAL_RESPONSE','EXTERNAL_RESPONSE','SETTLEMENT_PENDING')
        and o.status in ('DISPATCHED','CONFIRMED')
        and o.external_ref is not null
      order by c.updated_at
      limit greatest(1,least(50,coalesce((p_payload->>'limit')::int,20)))
    ) q;
    return jsonb_build_object('ok',true,'cells',arr);
  end if;

  if p_operation='RECONCILER_RECORD' then
    h := encode(digest(coalesce(p_payload->>'raw_response',''),'sha256'),'hex');
    insert into figure_eight.reconciliation_events(
      cell_id,source,event_key,stripe_event_id,checkout_session_id,
      payment_intent_id,mode,verified,query_used,raw_response,
      raw_response_sha256,facts
    )
    values(
      (p_payload->>'cell_id')::uuid,
      coalesce(p_payload->>'source','STRIPE_API_POLL'),
      p_payload->>'event_key',
      p_payload->>'stripe_event_id',
      p_payload->>'checkout_session_id',
      p_payload->>'payment_intent_id',
      coalesce(p_payload->>'mode','EXTERNAL_INDEPENDENT_SETTLEMENT'),
      coalesce((p_payload->>'verified')='true',false),
      p_payload->>'query_used',
      p_payload->>'raw_response',
      h,
      coalesce(p_payload->'facts','{}'::jsonb)
    )
    on conflict(event_key) do nothing
    returning * into r;

    if not found then
      select * into r from figure_eight.reconciliation_events where event_key=p_payload->>'event_key';
    end if;

    return jsonb_build_object('ok',true,'reconciliation_event',to_jsonb(r));
  end if;

  if p_operation='VERIFIER_CANDIDATES' then
    select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) into arr
    from (
      select r.reconciliation_event_id,r.cell_id,r.checkout_session_id,
             r.payment_intent_id,r.query_used,r.facts,c.state,c.version,c.state_evidence
      from figure_eight.reconciliation_events r
      join figure_eight.economic_cells c on c.cell_id=r.cell_id
      left join figure_eight.verification_fossils v
        on v.reconciliation_event_id=r.reconciliation_event_id
      where r.verified=true
        and v.verification_fossil_id is null
      order by r.created_at
      limit greatest(1,least(50,coalesce((p_payload->>'limit')::int,20)))
    ) q;
    return jsonb_build_object('ok',true,'events',arr);
  end if;

  if p_operation='VERIFIER_RECORD' then
    insert into figure_eight.verification_fossils(
      cell_id,reconciliation_event_id,provenance,source,verdict,
      query_used,raw_response_sha256,verdict_input,content_hash
    )
    values(
      (p_payload->>'cell_id')::uuid,
      (p_payload->>'reconciliation_event_id')::uuid,
      coalesce(p_payload->>'provenance','OBSERVED'),
      coalesce(p_payload->>'source','stripe_api_direct'),
      p_payload->>'verdict',
      p_payload->>'query_used',
      p_payload->>'raw_response_sha256',
      coalesce(p_payload->'verdict_input','{}'::jsonb),
      p_payload->>'content_hash'
    )
    on conflict(content_hash) do nothing
    returning * into v;
    if not found then
      select * into v from figure_eight.verification_fossils where content_hash=p_payload->>'content_hash';
    end if;

    return jsonb_build_object('ok',true,'verification_fossil',to_jsonb(v));
  end if;

  if p_operation='LEARNER_CANDIDATES' then
    select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) into arr
    from (
      select r.rev_atom_id,r.cell_id,r.signal_pattern,r.proposition_pattern,
             r.proof_pattern,c.state,c.state_evidence
      from figure_eight.rev_atoms r
      join figure_eight.economic_cells c on c.cell_id=r.cell_id
      where not exists (
        select 1 from figure_eight.mechanism_candidates m
        where m.rev_atom_id=r.rev_atom_id
      )
      order by r.created_at
      limit greatest(1,least(50,coalesce((p_payload->>'limit')::int,20)))
    ) q;
    return jsonb_build_object('ok',true,'rev_atoms',arr);
  end if;

  if p_operation='LEARNER_RECORD' then
    h := encode(digest(coalesce(p_payload::text,''),'sha256'),'hex');
    insert into figure_eight.mechanism_candidates(
      rev_atom_id,name,signal_pattern,proposition_pattern,price_pattern,
      channel_pattern,response_pattern,fulfillment_pattern,proof_pattern,
      conditions,outcome,status,content_hash
    )
    values(
      (p_payload->>'rev_atom_id')::uuid,
      p_payload->>'name',
      coalesce(p_payload->'signal_pattern','{}'::jsonb),
      coalesce(p_payload->'proposition_pattern','{}'::jsonb),
      coalesce(p_payload->'price_pattern','{}'::jsonb),
      coalesce(p_payload->'channel_pattern','{}'::jsonb),
      coalesce(p_payload->'response_pattern','{}'::jsonb),
      coalesce(p_payload->'fulfillment_pattern','{}'::jsonb),
      coalesce(p_payload->'proof_pattern','{}'::jsonb),
      coalesce(p_payload->'conditions','{}'::jsonb),
      coalesce(p_payload->'outcome','{}'::jsonb),
      'CANDIDATE',
      h
    )
    on conflict(rev_atom_id,mechanism_version) do nothing
    returning * into mc;
    if not found then
      select * into mc from figure_eight.mechanism_candidates
       where rev_atom_id=(p_payload->>'rev_atom_id')::uuid
       order by mechanism_version desc limit 1;
    end if;
    return jsonb_build_object('ok',true,'mechanism_candidate',to_jsonb(mc));
  end if;

  if p_operation='MECHANISM_VERIFY' then
    update figure_eight.mechanism_candidates
       set status='VERIFIED'
     where mechanism_candidate_id=(p_payload->>'mechanism_id')::uuid
       and exists (
         select 1
         from figure_eight.rev_atoms r
         where r.rev_atom_id=figure_eight.mechanism_candidates.rev_atom_id
           and r.truth_status='VERIFIED'
       )
     returning * into mc;
    if not found then
      return jsonb_build_object('ok',false,'reason','REV_ATOM_NOT_VERIFIED');
    end if;
    return jsonb_build_object('ok',true,'mechanism',to_jsonb(mc));
  end if;

  if p_operation='REPLICATOR_RECORD' then
    insert into figure_eight.replication_candidates(
      mechanism_id,opportunity_id,silo_id,match_score,matched_fields,
      evidence_refs,status,candidate_fingerprint
    )
    values(
      (p_payload->>'mechanism_id')::uuid,
      p_payload->>'opportunity_id',
      coalesce(p_payload->>'silo_id','core'),
      (p_payload->>'match_score')::numeric,
      coalesce(p_payload->'matched_fields','[]'::jsonb),
      coalesce(p_payload->'evidence_refs','[]'::jsonb),
      'QUEUED',
      p_payload->>'candidate_fingerprint'
    )
    on conflict(candidate_fingerprint) do nothing
    returning * into x;
    return jsonb_build_object('ok',true,'replication_candidate',x);
  end if;

  if p_operation='SEO_UPSERT' then
    insert into figure_eight.seo_opportunities(
      silo_id,source_fossil_id,query_text,intent_type,demand_evidence,
      evidence_status,source_count,independent_source_count,content_brief,
      release_status,canonical_url,freshness_at,target_path,human_outline,
      machine_summary,source_refs,publication_fingerprint,release_gate_result
    )
    values(
      coalesce(p_payload->>'silo_id','core'),
      nullif(p_payload->>'source_fossil_id','')::uuid,
      p_payload->>'query_text',
      coalesce(p_payload->>'intent_type','INFORMATIONAL'),
      coalesce(p_payload->'demand_evidence','{}'::jsonb),
      coalesce(p_payload->>'evidence_status','UNVERIFIED'),
      coalesce((p_payload->>'source_count')::int,0),
      coalesce((p_payload->>'independent_source_count')::int,0),
      coalesce(p_payload->'content_brief','{}'::jsonb),
      'HELD',
      p_payload->>'canonical_url',
      nullif(p_payload->>'freshness_at','')::timestamptz,
      p_payload->>'target_path',
      coalesce(p_payload->'human_outline','{}'::jsonb),
      coalesce(p_payload->'machine_summary','{}'::jsonb),
      coalesce(p_payload->'source_refs','[]'::jsonb),
      p_payload->>'publication_fingerprint',
      coalesce(p_payload->'release_gate_result','{}'::jsonb)
    )
    on conflict(silo_id,lower(query_text)) do update
      set demand_evidence=excluded.demand_evidence,
          evidence_status=excluded.evidence_status,
          source_count=excluded.source_count,
          independent_source_count=excluded.independent_source_count,
          content_brief=excluded.content_brief,
          freshness_at=excluded.freshness_at,
          target_path=excluded.target_path,
          human_outline=excluded.human_outline,
          machine_summary=excluded.machine_summary,
          source_refs=excluded.source_refs,
          publication_fingerprint=excluded.publication_fingerprint,
          release_gate_result=excluded.release_gate_result,
          updated_at=now()
    returning * into x;
    return jsonb_build_object('ok',true,'seo_opportunity',x);
  end if;

  if p_operation='TRUTH_REPORT' then
    select count(*) into x from figure_eight.rev_atoms;
    return jsonb_build_object(
      'verified_external_revenue_nzd',
      coalesce((
        select sum((settlement->>'amount_nzd')::numeric) from figure_eight.rev_atoms
      ),0),
      'independent_buyers',
      (select count(*) from figure_eight.rev_atoms),
      'settled_payments',
      (select count(*) from figure_eight.verification_fossils where verdict='VERIFIED'),
      'verified_economic_fossils',
      (select count(*) from figure_eight.rev_atoms),
      'verified_economic_loops',
      (select count(*) from figure_eight.rev_atoms)
    );
  end if;

  raise exception 'Unknown Figure Eight operation: %', p_operation;
end;
$$;

revoke execute on function public.figure_eight_worker_api(text,text,jsonb) from public, anon, authenticated;
grant execute on function public.figure_eight_worker_api(text,text,jsonb) to service_role;

revoke all on schema figure_eight from public, anon, authenticated;
grant usage on schema figure_eight to service_role;
grant select, insert, update on all tables in schema figure_eight to service_role;
grant execute on all functions in schema figure_eight to service_role;

alter default privileges for role postgres in schema figure_eight revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema figure_eight revoke execute on functions from public, anon, authenticated;

comment on schema figure_eight is 'Private Figure Eight runtime: durable cells, CAS state machine, outbox, independent verification, mechanisms, replication, and governed SEO.';
