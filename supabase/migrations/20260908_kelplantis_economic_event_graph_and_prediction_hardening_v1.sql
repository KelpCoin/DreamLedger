create table if not exists public.normalized_events (
  event_id uuid primary key default gen_random_uuid(), source_system text not null, raw_event_id text not null, event_type text not null,
  actor_id text, target_id text, location_id text, occurred_at timestamptz not null, session_id uuid,
  metadata jsonb not null default '{}'::jsonb, prev_event_id uuid references public.normalized_events(event_id), actor_type text, target_type text,
  event_category text, economic_relevance boolean not null default false, evidence_hash text not null, created_at timestamptz not null default now(),
  constraint normalized_events_source_raw_key unique (source_system, raw_event_id)
);
create index if not exists normalized_events_type_time_idx on public.normalized_events(event_type, occurred_at desc);
create index if not exists normalized_events_actor_time_idx on public.normalized_events(actor_id, occurred_at desc);
create index if not exists normalized_events_location_time_idx on public.normalized_events(location_id, occurred_at desc);
create index if not exists normalized_events_economic_time_idx on public.normalized_events(economic_relevance, occurred_at desc);

create table if not exists public.event_relationships (
  relationship_id uuid primary key default gen_random_uuid(), source_event_type text not null, target_event_type text not null,
  relationship_type text not null, lag_distribution jsonb not null default '{}'::jsonb, conditional_intensity numeric,
  confidence numeric(5,4), is_causal boolean not null default false, evidence_hash text not null, sample_size integer not null default 0,
  first_observed timestamptz, last_observed timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint event_relationships_type_ck check (relationship_type in ('FOLLOWED_BY','PRECEDED_BY','SAME_ACTOR','SAME_LOCATION','SAME_SESSION','CORRELATED_WITH','PREDICTIVE_DEPENDENCY')),
  constraint event_relationships_confidence_ck check (confidence is null or confidence between 0 and 1),
  constraint event_relationships_intensity_ck check (conditional_intensity is null or conditional_intensity >= 0),
  constraint event_relationships_sample_ck check (sample_size >= 0),
  constraint event_relationships_key unique (source_event_type,target_event_type,relationship_type)
);

create table if not exists public.event_motifs (
  motif_id uuid primary key default gen_random_uuid(), event_sequence text[] not null, frequency integer not null default 0,
  first_observed timestamptz, last_observed timestamptz, avg_interval interval, confidence numeric(5,4), economic_relevance numeric(5,4),
  evidence_hash text not null, pattern_score numeric, decayed_score numeric, decay_lambda numeric not null default 0.1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint event_motifs_frequency_ck check (frequency >= 0),
  constraint event_motifs_confidence_ck check (confidence is null or confidence between 0 and 1),
  constraint event_motifs_economic_relevance_ck check (economic_relevance is null or economic_relevance between 0 and 1),
  constraint event_motifs_lambda_ck check (decay_lambda >= 0),
  constraint event_motifs_sequence_key unique (event_sequence)
);
create index if not exists event_motifs_last_observed_idx on public.event_motifs(last_observed desc);
create index if not exists economic_predictions_status_window_idx on public.economic_predictions(status,prediction_window_start,prediction_window_end);
create index if not exists economic_predictions_pattern_idx on public.economic_predictions(pattern_id);

create or replace function public.normalize_kelplantis_event() returns trigger language plpgsql security definer set search_path=public as $$
declare v_hash text; begin
  v_hash := encode(digest(coalesce(new.id::text,'') || '|' || new.event_type || '|' || new.occurred_at::text || '|' || new.payload::text,'sha256'),'hex');
  insert into public.normalized_events(source_system,raw_event_id,event_type,actor_id,occurred_at,metadata,event_category,economic_relevance,evidence_hash)
  values('kelplantis',new.id::text,new.event_type,new.player_token::text,new.occurred_at,new.payload,
    case when new.event_type ilike '%combat%' or new.event_type ilike '%attack%' or new.event_type ilike '%boss%' then 'combat' when new.event_type ilike '%quest%' then 'quest' when new.event_type ilike '%move%' or new.event_type ilike '%enter%' then 'movement' else 'gameplay' end,
    (new.event_type ilike '%buy%' or new.event_type ilike '%sell%' or new.event_type ilike '%payment%' or new.event_type ilike '%reward%'),v_hash)
  on conflict(source_system,raw_event_id) do nothing; return new; end; $$;

create or replace function public.normalize_economic_event() returns trigger language plpgsql security definer set search_path=public as $$
declare v_hash text; begin
  v_hash := encode(digest(coalesce(new.event_id,'') || '|' || coalesce(new.sku_id,'') || '|' || new.created_at::text || '|' || row_to_json(new)::text,'sha256'),'hex');
  insert into public.normalized_events(source_system,raw_event_id,event_type,target_id,occurred_at,metadata,event_category,economic_relevance,evidence_hash)
  values('economic',new.event_id,new.event_id,new.sku_id,new.created_at,
    jsonb_build_object('opportunity_id',new.opportunity_id,'event_pattern_id',new.event_pattern_id,'offer_id',new.offer_id,'buyer_action_verified',new.buyer_action_verified,'payment_settled',new.payment_settled,'fulfilment_verified',new.fulfilment_verified,'evidence_verified',new.evidence_verified,'amount_nzd',new.amount_nzd,'stripe_checkout_session',new.stripe_checkout_session,'stripe_payment_intent',new.stripe_payment_intent,'evidence_ref',new.evidence_ref),'commerce',true,v_hash)
  on conflict(source_system,raw_event_id) do nothing; return new; end; $$;

drop trigger if exists trg_normalize_kelplantis_event on public.kelplantis_events;
create trigger trg_normalize_kelplantis_event after insert on public.kelplantis_events for each row execute function public.normalize_kelplantis_event();
drop trigger if exists trg_normalize_economic_event on public.economic_events;
create trigger trg_normalize_economic_event after insert on public.economic_events for each row execute function public.normalize_economic_event();

insert into public.normalized_events(source_system,raw_event_id,event_type,actor_id,occurred_at,metadata,event_category,economic_relevance,evidence_hash)
select 'kelplantis',e.id::text,e.event_type,e.player_token::text,e.occurred_at,e.payload,
 case when e.event_type ilike '%combat%' or e.event_type ilike '%attack%' or e.event_type ilike '%boss%' then 'combat' when e.event_type ilike '%quest%' then 'quest' when e.event_type ilike '%move%' or e.event_type ilike '%enter%' then 'movement' else 'gameplay' end,
 (e.event_type ilike '%buy%' or e.event_type ilike '%sell%' or e.event_type ilike '%payment%' or e.event_type ilike '%reward%'),
 encode(digest(coalesce(e.id::text,'') || '|' || e.event_type || '|' || e.occurred_at::text || '|' || e.payload::text,'sha256'),'hex')
from public.kelplantis_events e on conflict(source_system,raw_event_id) do nothing;

insert into public.normalized_events(source_system,raw_event_id,event_type,target_id,occurred_at,metadata,event_category,economic_relevance,evidence_hash)
select 'economic',e.event_id,e.event_id,e.sku_id,e.created_at,
 jsonb_build_object('opportunity_id',e.opportunity_id,'event_pattern_id',e.event_pattern_id,'offer_id',e.offer_id,'buyer_action_verified',e.buyer_action_verified,'payment_settled',e.payment_settled,'fulfilment_verified',e.fulfilment_verified,'evidence_verified',e.evidence_verified,'amount_nzd',e.amount_nzd,'stripe_checkout_session',e.stripe_checkout_session,'stripe_payment_intent',e.stripe_payment_intent,'evidence_ref',e.evidence_ref),'commerce',true,
 encode(digest(coalesce(e.event_id,'') || '|' || coalesce(e.sku_id,'') || '|' || e.created_at::text || '|' || row_to_json(e)::text,'sha256'),'hex')
from public.economic_events e on conflict(source_system,raw_event_id) do nothing;

create or replace function public.claim_economic_model_task(p_task_id uuid,p_lease_seconds integer default 300) returns public.economic_model_tasks language plpgsql security definer set search_path=public as $$
declare v_task public.economic_model_tasks; begin
 if p_lease_seconds<30 or p_lease_seconds>3600 then raise exception 'invalid lease seconds'; end if;
 update public.economic_model_tasks set status='running',attempt_count=attempt_count+1,started_at=coalesce(started_at,now()),leased_until=now()+make_interval(secs=>p_lease_seconds)
 where task_id=p_task_id and status in('pending','running') and (status='pending' or leased_until is null or leased_until<now()) returning * into v_task;
 if v_task.task_id is null then raise exception 'task unavailable or lease active'; end if; return v_task; end; $$;

create or replace function public.requeue_expired_economic_model_tasks() returns integer language plpgsql security definer set search_path=public as $$
declare v_count integer; begin
 update public.economic_model_tasks set status='pending',leased_until=null,last_error=coalesce(last_error,'') || case when coalesce(last_error,'')='' then '' else E'\n' end || 'LEASE_EXPIRED:' || now()::text
 where status='running' and leased_until is not null and leased_until<now(); get diagnostics v_count=row_count; return v_count; end; $$;

comment on table public.normalized_events is 'Canonical event stream retaining source provenance and evidence hash.';
comment on table public.event_relationships is 'Observed/inferred temporal relationships. Predictive dependency is not causal evidence.';
comment on table public.event_motifs is 'Recurring event sequences used for pattern scoring and calibrated prediction.';
