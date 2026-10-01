begin;

create schema if not exists factory;

create table if not exists factory.blueprints (
  blueprint_id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  version integer not null default 1 check (version > 0),
  name text not null,
  purpose text not null,
  inputs jsonb not null default '[]'::jsonb,
  outputs jsonb not null default '[]'::jsonb,
  capabilities jsonb not null default '[]'::jsonb,
  default_autonomy_level integer not null default 0 check (default_autonomy_level between 0 and 6),
  max_autonomy_level integer not null default 2 check (max_autonomy_level between 0 and 6),
  risk_class text not null default 'LOW' check (risk_class in ('LOW','MEDIUM','HIGH','CRITICAL')),
  budget_cents_per_run integer not null default 0 check (budget_cents_per_run >= 0),
  max_actions_per_run integer not null default 10 check (max_actions_per_run > 0),
  kill_switch_key text not null,
  definition jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists factory.instances (
  instance_id uuid primary key default gen_random_uuid(),
  blueprint_id uuid not null references factory.blueprints(blueprint_id),
  parent_instance_id uuid references factory.instances(instance_id),
  silo text not null,
  name text not null,
  status text not null default 'PLACED' check (status in ('PLACED','ARMED','RUNNING','PAUSED','FAILED','RETIRED')),
  autonomy_level integer not null default 0 check (autonomy_level between 0 and 6),
  budget_cents_per_run integer not null default 0 check (budget_cents_per_run >= 0),
  max_actions_per_run integer not null default 10 check (max_actions_per_run > 0),
  kill_switch_state text not null default 'OFF' check (kill_switch_state in ('OFF','ON')),
  placement jsonb not null default '{}'::jsonb,
  configuration jsonb not null default '{}'::jsonb,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists factory_instances_silo_status_idx on factory.instances(silo,status);
create index if not exists factory_instances_blueprint_idx on factory.instances(blueprint_id);

create table if not exists factory.runs (
  run_id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references factory.instances(instance_id),
  orchestrator_task_id uuid,
  state text not null default 'CREATED' check (state in ('CREATED','RUNNING','SUCCEEDED','FAILED','CANCELLED','KILLED')),
  objective text not null,
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  evidence_refs jsonb not null default '[]'::jsonb,
  action_count integer not null default 0 check (action_count >= 0),
  cost_cents integer not null default 0 check (cost_cents >= 0),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists factory_runs_instance_created_idx on factory.runs(instance_id,created_at desc);
create index if not exists factory_runs_state_idx on factory.runs(state,created_at desc);

create table if not exists factory.signals (
  signal_id uuid primary key default gen_random_uuid(),
  run_id uuid references factory.runs(run_id),
  instance_id uuid references factory.instances(instance_id),
  signal_type text not null check (signal_type in ('POSITIVE','NEGATIVE','SYNTHESIZED','TRIANGULATED')),
  subject text not null,
  claim text not null,
  confidence numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),
  evidence_refs jsonb not null default '[]'::jsonb,
  source_count integer not null default 0 check (source_count >= 0),
  derived_from jsonb not null default '[]'::jsonb,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists factory_signals_type_observed_idx on factory.signals(signal_type,observed_at desc);
create index if not exists factory_signals_instance_idx on factory.signals(instance_id,observed_at desc);

create or replace function factory.clone_instance(
  p_source_instance_id uuid,
  p_silo text,
  p_name text default null,
  p_placement jsonb default '{}'::jsonb,
  p_configuration jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path=pg_catalog,public,factory
as $$
declare
  v_source factory.instances;
  v_id uuid;
begin
  select * into v_source from factory.instances where instance_id=p_source_instance_id;
  if v_source.instance_id is null then raise exception 'factory instance not found'; end if;
  if v_source.kill_switch_state='ON' then raise exception 'source factory kill switch is ON'; end if;

  insert into factory.instances(
    blueprint_id,parent_instance_id,silo,name,status,autonomy_level,
    budget_cents_per_run,max_actions_per_run,kill_switch_state,placement,configuration
  ) values (
    v_source.blueprint_id,v_source.instance_id,p_silo,
    coalesce(p_name,v_source.name || ' clone'),'PLACED',v_source.autonomy_level,
    v_source.budget_cents_per_run,v_source.max_actions_per_run,'OFF',
    coalesce(p_placement,'{}'::jsonb),coalesce(p_configuration,v_source.configuration)
  ) returning instance_id into v_id;

  return v_id;
end;
$$;

create or replace function factory.record_signal(
  p_signal_type text,
  p_subject text,
  p_claim text,
  p_run_id uuid default null,
  p_instance_id uuid default null,
  p_confidence numeric default null,
  p_evidence_refs jsonb default '[]'::jsonb,
  p_source_count integer default 0,
  p_derived_from jsonb default '[]'::jsonb
) returns uuid
language plpgsql security definer set search_path=pg_catalog,public,factory
as $$
declare v_id uuid;
begin
  if p_signal_type not in ('POSITIVE','NEGATIVE','SYNTHESIZED','TRIANGULATED') then
    raise exception 'invalid signal type';
  end if;
  insert into factory.signals(
    run_id,instance_id,signal_type,subject,claim,confidence,evidence_refs,source_count,derived_from
  ) values (
    p_run_id,p_instance_id,p_signal_type,p_subject,p_claim,p_confidence,
    coalesce(p_evidence_refs,'[]'::jsonb),coalesce(p_source_count,0),coalesce(p_derived_from,'[]'::jsonb)
  ) returning signal_id into v_id;
  return v_id;
end;
$$;

insert into factory.blueprints
  (slug,version,name,purpose,inputs,outputs,capabilities,default_autonomy_level,max_autonomy_level,risk_class,budget_cents_per_run,max_actions_per_run,kill_switch_key,definition)
values
  ('truth-oracle','1','Truth Oracle Factory','Observe external facts, retrieve evidence, classify freshness and contradictions, and publish inspectable claims.',
   '["source","query","scope"]'::jsonb,'["claim","evidence","contradiction"]'::jsonb,
   '["retrieval","source_validation","freshness","contradiction_detection"]'::jsonb,1,4,'MEDIUM',0,20,'TRUTH_ORACLE',
   '{"promotion_requires_evidence":true,"never_authorize_payment":true}'::jsonb),
  ('verification','1','Verification Factory','Run deterministic checks against software, data, deployment and economic state.',
   '["target","test_contract"]'::jsonb,'["proof","positive_signal","negative_signal"]'::jsonb,
   '["tests","runtime_probe","hashing","reconciliation"]'::jsonb,1,5,'HIGH',0,30,'VERIFICATION',
   '{"independent_verifier":true,"promotion_requires_evidence":true}'::jsonb),
  ('commerce','1','Commerce Factory','Operate bounded commerce workflows from offer discovery through checkout, fulfilment and reconciliation.',
   '["offer","customer_intent","policy"]'::jsonb,'["action","economic_outcome","evidence"]'::jsonb,
   '["catalog","checkout","fulfilment","reconciliation"]'::jsonb,0,3,'HIGH',0,15,'COMMERCE',
   '{"external_financial_action_requires_authority":true,"settlement_is_canonical":true}'::jsonb),
  ('growth','1','Growth Factory','Run bounded experiments that seek measurable demand and conversion outcomes.',
   '["offer","audience","experiment"]'::jsonb,'["experiment_result","signal","evidence"]'::jsonb,
   '["research","content","experiment","measurement"]'::jsonb,0,3,'MEDIUM',0,15,'GROWTH',
   '{"no_unbounded_spend":true,"negative_results_are_retained":true}'::jsonb),
  ('engineering','1','Engineering Factory','Turn validated work items into tested, reviewable production changes.',
   '["task","repository","acceptance_criteria"]'::jsonb,'["commit","test_result","proof"]'::jsonb,
   '["implementation","testing","repair","deployment"]'::jsonb,1,5,'HIGH',0,40,'ENGINEERING',
   '{"deploy_requires_promotion_gate":true,"rollback_required":true}'::jsonb)
on conflict (slug) do update set
  version=excluded.version,
  name=excluded.name,
  purpose=excluded.purpose,
  inputs=excluded.inputs,
  outputs=excluded.outputs,
  capabilities=excluded.capabilities,
  default_autonomy_level=excluded.default_autonomy_level,
  max_autonomy_level=excluded.max_autonomy_level,
  risk_class=excluded.risk_class,
  max_actions_per_run=excluded.max_actions_per_run,
  kill_switch_key=excluded.kill_switch_key,
  definition=excluded.definition,
  updated_at=now();

grant usage on schema factory to service_role;
grant select,insert,update,delete on all tables in schema factory to service_role;
grant execute on function factory.clone_instance(uuid,text,text,jsonb,jsonb) to service_role;
grant execute on function factory.record_signal(text,text,text,uuid,uuid,numeric,jsonb,integer,jsonb) to service_role;
revoke all on all tables in schema factory from public,anon,authenticated;
revoke all on all functions in schema factory from public,anon,authenticated;

enable row level security on factory.blueprints;
enable row level security on factory.instances;
enable row level security on factory.runs;
enable row level security on factory.signals;

commit;
