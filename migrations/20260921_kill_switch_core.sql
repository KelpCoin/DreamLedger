create table if not exists public.kill_switch_events (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('agent','model','pipeline','mcp_server')),
  target_id text not null,
  reason text not null,
  triggered_by text not null,
  triggered_at timestamptz not null default now(),
  reversed_at timestamptz,
  reversed_by text
);

create index if not exists kill_switch_active_idx
  on public.kill_switch_events(scope, target_id)
  where reversed_at is null;

create or replace function public.is_killed(p_scope text, p_target_id text)
returns boolean
language sql stable security definer set search_path=public
as $$
  select exists (
    select 1 from public.kill_switch_events
    where scope = p_scope
      and target_id = p_target_id
      and reversed_at is null
  );
$$;
