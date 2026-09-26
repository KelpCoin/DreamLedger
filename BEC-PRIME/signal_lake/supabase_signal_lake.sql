create schema if not exists signal_lake;

create table if not exists signal_lake.bronze_observations (
  observation_id uuid primary key default gen_random_uuid(),
  source text not null,
  source_item_id text not null,
  source_url text,
  observed_at timestamptz not null default now(),
  published_at timestamptz,
  raw_content text not null,
  raw_metadata jsonb not null default '{}'::jsonb,
  content_hash text not null,
  source_type text not null,
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(source, source_item_id, content_hash)
);

create table if not exists signal_lake.silver_signals (
  signal_id uuid primary key default gen_random_uuid(),
  observation_id uuid not null references signal_lake.bronze_observations(observation_id),
  source text not null,
  source_item_id text not null,
  source_url text,
  observed_at timestamptz not null,
  published_at timestamptz,
  author text,
  raw_content text not null,
  raw_metadata jsonb not null default '{}'::jsonb,
  content_hash text not null,
  source_type text not null,
  language text,
  topic jsonb not null default '[]'::jsonb,
  entities jsonb not null default '[]'::jsonb,
  intent_signals jsonb not null default '[]'::jsonb,
  demand_signals jsonb not null default '[]'::jsonb,
  commercial_signals jsonb not null default '[]'::jsonb,
  confidence numeric not null default 0,
  commercial_relevance numeric not null default 0,
  dedupe_group text,
  processing_state text not null default 'NORMALIZED',
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(observation_id)
);

create table if not exists signal_lake.gold_signals (
  signal_id uuid primary key default gen_random_uuid(),
  silver_signal_id uuid not null references signal_lake.silver_signals(signal_id),
  signal_type text not null,
  buyer_intent numeric not null default 0,
  demand_score numeric not null default 0,
  commercial_score numeric not null default 0,
  confidence numeric not null default 0,
  promoted boolean not null default false,
  promotion_reason text,
  buyer_definition text,
  problem_statement text,
  evidence jsonb not null default '{}'::jsonb,
  provenance jsonb not null default '{}'::jsonb,
  promoted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(silver_signal_id, signal_type)
);

grant usage on schema signal_lake to service_role;
grant select, insert, update on all tables in schema signal_lake to service_role;

create or replace function public.ingest_bronze_observation(p_observation jsonb)
returns uuid language plpgsql security invoker as $$
declare v_id uuid;
begin
 insert into signal_lake.bronze_observations(source,source_item_id,source_url,observed_at,published_at,raw_content,raw_metadata,content_hash,source_type,provenance)
 values(p_observation->>'source',p_observation->>'source_item_id',p_observation->>'source_url',
 coalesce((p_observation->>'observed_at')::timestamptz,now()),
 nullif(p_observation->>'published_at','')::timestamptz,
 coalesce(p_observation->>'raw_content',''),coalesce(p_observation->'raw_metadata','{}'::jsonb),
 p_observation->>'content_hash',coalesce(p_observation->>'source_type','UNKNOWN'),
 coalesce(p_observation->'provenance','{}'::jsonb))
 on conflict(source,source_item_id,content_hash) do update set observed_at=excluded.observed_at
 returning observation_id into v_id;
 return v_id;
end $$;

create or replace function public.list_unprocessed_bronze()
returns setof signal_lake.bronze_observations language sql security invoker as $$
 select b.* from signal_lake.bronze_observations b
 left join signal_lake.silver_signals s on s.observation_id=b.observation_id
 where s.observation_id is null order by b.created_at asc limit 100;
$$;

create or replace function public.normalize_signal(p_observation jsonb,p_signal_types jsonb,p_buyer_intent numeric,p_commercial_relevance numeric,p_confidence numeric)
returns uuid language plpgsql security invoker as $$
declare v_id uuid;
begin
 insert into signal_lake.silver_signals(observation_id,source,source_item_id,source_url,observed_at,published_at,raw_content,raw_metadata,content_hash,source_type,intent_signals,demand_signals,commercial_signals,confidence,commercial_relevance,dedupe_group,processing_state,provenance)
 values((p_observation->>'observation_id')::uuid,p_observation->>'source',p_observation->>'source_item_id',p_observation->>'source_url',
 (p_observation->>'observed_at')::timestamptz,nullif(p_observation->>'published_at','')::timestamptz,
 coalesce(p_observation->>'raw_content',''),coalesce(p_observation->'raw_metadata','{}'::jsonb),
 p_observation->>'content_hash',coalesce(p_observation->>'source_type','UNKNOWN'),
 p_signal_types,p_signal_types,p_signal_types,p_confidence,p_commercial_relevance,
 md5(coalesce(p_observation->>'source','')||'|'||coalesce(p_observation->>'content_hash','')),
 case when p_confidence>=.7 and p_commercial_relevance>=.4 then 'QUALIFIED' else 'NORMALIZED' end,
 coalesce(p_observation->'provenance','{}'::jsonb))
 on conflict(observation_id) do update set confidence=excluded.confidence,commercial_relevance=excluded.commercial_relevance,
 intent_signals=excluded.intent_signals,demand_signals=excluded.demand_signals,commercial_signals=excluded.commercial_signals,
 processing_state=excluded.processing_state,updated_at=now()
 returning signal_id into v_id;
 insert into signal_lake.gold_signals(silver_signal_id,signal_type,buyer_intent,demand_score,commercial_score,confidence,promoted,promotion_reason,problem_statement,evidence,provenance,promoted_at)
 select v_id,x,p_buyer_intent,p_commercial_relevance,p_commercial_relevance,p_confidence,
 (p_confidence>=.7 and p_commercial_relevance>=.4),
 case when p_confidence>=.7 and p_commercial_relevance>=.4 then 'Deterministic Gormlet qualification' end,
 left(coalesce(p_observation->>'raw_content',''),1000),
 jsonb_build_object('observation_id',p_observation->>'observation_id'),
 coalesce(p_observation->'provenance','{}'::jsonb),
 case when p_confidence>=.7 and p_commercial_relevance>=.4 then now() end
 from jsonb_array_elements_text(p_signal_types) x
 on conflict(silver_signal_id,signal_type) do update set promoted=excluded.promoted,confidence=excluded.confidence,promoted_at=excluded.promoted_at;
 return v_id;
end $$;

revoke all on function public.ingest_bronze_observation(jsonb) from public,anon,authenticated;
revoke all on function public.list_unprocessed_bronze() from public,anon,authenticated;
revoke all on function public.normalize_signal(jsonb,jsonb,numeric,numeric,numeric) from public,anon,authenticated;
grant execute on function public.ingest_bronze_observation(jsonb) to service_role;
grant execute on function public.list_unprocessed_bronze() to service_role;
grant execute on function public.normalize_signal(jsonb,jsonb,numeric,numeric,numeric) to service_role;
