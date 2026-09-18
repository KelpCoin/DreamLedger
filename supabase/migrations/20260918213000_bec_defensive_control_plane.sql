-- BEC defensive control plane registry and server-side audit trail.
create table if not exists public.agent_bridge_security_events (
  id bigint generated always as identity primary key,
  event_id text not null unique,
  occurred_at timestamptz not null default now(),
  actor text not null,
  action text not null,
  path text not null,
  decision text not null check (decision in ('ALLOW','DENY')),
  reason text,
  correlation_id text,
  request_hash text,
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists idx_agent_bridge_security_events_occurred_at on public.agent_bridge_security_events (occurred_at desc);
create index if not exists idx_agent_bridge_security_events_correlation on public.agent_bridge_security_events (correlation_id);
alter table public.agent_bridge_security_events enable row level security;
revoke all on table public.agent_bridge_security_events from anon, authenticated;
grant select, insert on table public.agent_bridge_security_events to service_role;

create table if not exists public.bec_component_registry (
  component_id text primary key,
  component_version text not null,
  source_path text not null,
  source_revision text not null,
  role text not null,
  status text not null check (status in ('ACTIVE','QUARANTINED','RETIRED')),
  registered_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);
alter table public.bec_component_registry enable row level security;
revoke all on table public.bec_component_registry from anon, authenticated;
grant select, insert, update on table public.bec_component_registry to service_role;
comment on table public.agent_bridge_security_events is 'Server-side defensive audit trail for AgentBridge policy decisions. Not public API data.';
comment on table public.bec_component_registry is 'Authoritative registry linking Elohim, Gauntlet and Truth Oracle revisions to the economic control plane.';
insert into public.bec_component_registry
(component_id,component_version,source_path,source_revision,role,status,metadata)
values
('ELOHIM','V6','BEC-PRIME/council/Elohim.js','bf1b66976c60b3b16000a5a2ead39b54bc444d20','decision','ACTIVE','{"authority":"proposal_only"}'),
('GAUNTLET','V6','BEC-PRIME/gauntlet/GauntletV6.js','a831c04cdcbff69e13fe190ac34395d6f1fd6a4a','commercial_gate','ACTIVE','{"authority":"fail_closed"}'),
('TRUTH_ORACLE','V2','BEC-PRIME/runtime/TruthOracle.js','033b82fcd55ff11bd3dfb84b8d164b5ba01d5e72','evidence','ACTIVE','{"authority":"evidence_only"}')
on conflict (component_id) do update set
component_version=excluded.component_version,source_path=excluded.source_path,source_revision=excluded.source_revision,role=excluded.role,status=excluded.status,metadata=excluded.metadata;