alter table public.control_bridge_notes add column if not exists lane text not null default 'discovery';
alter table public.control_bridge_notes add column if not exists priority smallint not null default 50;
alter table public.control_bridge_notes add column if not exists silo_id text not null default 'SILO_GENERAL';
alter table public.control_bridge_notes add column if not exists expires_at timestamptz;
alter table public.control_bridge_notes add column if not exists source_system text;

create index if not exists idx_control_bridge_lane_priority_created
  on public.control_bridge_notes(lane, priority desc, created_at desc);

create index if not exists idx_control_bridge_silo_created
  on public.control_bridge_notes(silo_id, created_at desc);

create index if not exists idx_control_bridge_expiry
  on public.control_bridge_notes(expires_at)
  where expires_at is not null;
