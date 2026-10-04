-- PHINHAVEN guild macro-objectives, depth presence, and persistent structures.
-- Prepared for staging/production review. This migration is not applied here.

create table if not exists public.phinhaven_depth_tiles (
  id uuid primary key default gen_random_uuid(),
  depth_id integer not null,
  tile_x integer not null,
  tile_y integer not null,
  tile_key text generated always as (depth_id::text || ':' || tile_x::text || ':' || tile_y::text) stored,
  controller_guild_id uuid references public.phinhaven_guilds(id),
  presence_score bigint not null default 0,
  fortification_score bigint not null default 0,
  resource_control jsonb not null default '{}'::jsonb,
  world_state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique(depth_id, tile_x, tile_y)
);

create index if not exists idx_phinhaven_depth_tiles_controller
  on public.phinhaven_depth_tiles(controller_guild_id, depth_id);

create table if not exists public.phinhaven_guild_objectives (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.phinhaven_guilds(id),
  depth_id integer not null,
  tile_id uuid references public.phinhaven_depth_tiles(id),
  objective_key text not null,
  objective_type text not null check (objective_type in ('FORTRESS','OUTPOST','RESOURCE_NETWORK','EXPEDITION','DEFENCE','CONTROL')),
  title text not null,
  description text not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','COMPLETED','FAILED','ABANDONED','DESTROYED')),
  target jsonb not null default '{}'::jsonb,
  progress jsonb not null default '{}'::jsonb,
  required_components jsonb not null default '{}'::jsonb,
  contributed_components jsonb not null default '{}'::jsonb,
  reward jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  destroyed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(guild_id, objective_key)
);

create index if not exists idx_phinhaven_guild_objectives_depth
  on public.phinhaven_guild_objectives(depth_id, status);

create table if not exists public.phinhaven_guild_objective_contributions (
  id uuid primary key default gen_random_uuid(),
  objective_id uuid not null references public.phinhaven_guild_objectives(id),
  guild_id uuid not null references public.phinhaven_guilds(id),
  player_id uuid references public.phinhaven_players(id),
  contribution_type text not null check (contribution_type in ('MATERIAL','GOLD','LABOUR','DEFENCE','EXPLORATION')),
  amount numeric not null check (amount > 0),
  component_key text,
  source_event_id bigint references public.phinhaven_events(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_phinhaven_objective_contributions_objective
  on public.phinhaven_guild_objective_contributions(objective_id, created_at);

create table if not exists public.phinhaven_guild_structures (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.phinhaven_guilds(id),
  depth_id integer not null,
  tile_id uuid not null references public.phinhaven_depth_tiles(id),
  objective_id uuid references public.phinhaven_guild_objectives(id),
  structure_key text not null,
  structure_type text not null check (structure_type in ('FORTRESS','OUTPOST','WAREHOUSE','WATCHTOWER','GATE')),
  state text not null default 'BUILDING' check (state in ('BUILDING','ACTIVE','DAMAGED','DESTROYED')),
  integrity integer not null default 100 check (integrity between 0 and 100),
  defence_score bigint not null default 0,
  stored_components jsonb not null default '{}'::jsonb,
  salvage_ratio numeric not null default 0.50 check (salvage_ratio >= 0 and salvage_ratio <= 1),
  built_at timestamptz,
  destroyed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(guild_id, structure_key)
);

create index if not exists idx_phinhaven_guild_structures_tile
  on public.phinhaven_guild_structures(depth_id, tile_id, state);

create table if not exists public.phinhaven_guild_control_history (
  id bigint generated always as identity primary key,
  depth_id integer not null,
  tile_id uuid references public.phinhaven_depth_tiles(id),
  guild_id uuid references public.phinhaven_guilds(id),
  event_type text not null check (event_type in ('CLAIMED','FORTIFIED','CONTESTED','LOST','RECAPTURED','STRUCTURE_BUILT','STRUCTURE_DAMAGED','STRUCTURE_DESTROYED')),
  source_event_id bigint references public.phinhaven_events(id),
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists idx_phinhaven_guild_control_history_depth
  on public.phinhaven_guild_control_history(depth_id, occurred_at desc);

comment on table public.phinhaven_depth_tiles is
  'Persistent world partition. Tile state is authoritative world state, not client presentation.';

comment on table public.phinhaven_guild_objectives is
  'Guild-scale goals that require coordinated player contributions and create persistent world changes.';

comment on table public.phinhaven_guild_structures is
  'Persistent guild-built structures. Destruction is stateful and can return salvage according to salvage_ratio.';

comment on table public.phinhaven_guild_control_history is
  'Append-only history of guild presence/control and structure events.';
