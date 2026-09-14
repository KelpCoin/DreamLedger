create table if not exists public.kelplantis_resource_nodes (
  id uuid primary key default gen_random_uuid(),
  depth_id integer not null default 1,
  resource_type text not null,
  x integer not null,
  y integer not null,
  amount integer not null default 10 check (amount >= 0),
  max_amount integer not null default 10 check (max_amount > 0),
  respawn_at timestamptz,
  depleted_count integer not null default 0 check (depleted_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kelplantis_resource_nodes_type_ck check (resource_type in ('kelp','gold_vein','pearl')),
  constraint kelplantis_resource_nodes_position_ck check (x >= 0 and y >= 0)
);

create index if not exists kelplantis_resource_nodes_depth_idx on public.kelplantis_resource_nodes(depth_id);
create index if not exists kelplantis_resource_nodes_active_idx on public.kelplantis_resource_nodes(depth_id, resource_type, respawn_at);

alter table public.kelplantis_resource_nodes enable row level security;
drop policy if exists "kelplantis resource nodes public read" on public.kelplantis_resource_nodes;
create policy "kelplantis resource nodes public read" on public.kelplantis_resource_nodes for select to anon, authenticated using (true);

grant select on table public.kelplantis_resource_nodes to anon, authenticated;

create or replace function public.kelplantis_harvest_resource_for_token(p_player_token uuid, p_node_id uuid)
returns table(resource_type text, yield_amount integer, remaining_amount integer, respawn_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player public.kelplantis_players;
  v_node public.kelplantis_resource_nodes;
  v_yield integer;
  v_inventory jsonb;
begin
  select * into v_player
  from public.kelplantis_players
  where player_token = p_player_token
  for update;
  if not found then raise exception 'UNKNOWN_PLAYER'; end if;

  select * into v_node
  from public.kelplantis_resource_nodes
  where id = p_node_id and depth_id = 1
  for update;
  if not found then raise exception 'RESOURCE_NODE_NOT_FOUND'; end if;

  if v_node.amount = 0 then
    if v_node.respawn_at is null or v_node.respawn_at > now() then
      raise exception 'RESOURCE_NODE_DEPLETED';
    end if;
    update public.kelplantis_resource_nodes
      set amount = max_amount, respawn_at = null, updated_at = now()
      where id = v_node.id;
    v_node.amount := v_node.max_amount;
  end if;

  v_yield := least(5, v_node.amount);
  v_inventory := coalesce(v_player.inventory, '{}'::jsonb);
  if v_node.resource_type = 'kelp' then
    v_inventory := jsonb_set(v_inventory, '{kelp}', to_jsonb(coalesce((v_inventory->>'kelp')::integer, 0) + v_yield), true);
  elsif v_node.resource_type = 'gold_vein' then
    v_inventory := jsonb_set(v_inventory, '{gold}', to_jsonb(coalesce((v_inventory->>'gold')::integer, 0) + v_yield), true);
  elsif v_node.resource_type = 'pearl' then
    v_inventory := jsonb_set(v_inventory, '{pearls}', to_jsonb(coalesce((v_inventory->>'pearls')::integer, 0) + v_yield), true);
  end if;

  update public.kelplantis_players
    set inventory = v_inventory, updated_at = now()
    where id = v_player.id;

  update public.kelplantis_resource_nodes
    set amount = amount - v_yield,
        respawn_at = case when amount - v_yield <= 0 then now() + interval '15 minutes' else respawn_at end,
        depleted_count = depleted_count + case when amount - v_yield <= 0 then 1 else 0 end,
        updated_at = now()
    where id = v_node.id;

  return query
    select v_node.resource_type,
           v_yield,
           greatest(v_node.amount - v_yield, 0),
           case when v_node.amount - v_yield <= 0 then now() + interval '15 minutes' else v_node.respawn_at end;
end;
$$;

revoke execute on function public.kelplantis_harvest_resource_for_token(uuid, uuid) from public;
grant execute on function public.kelplantis_harvest_resource_for_token(uuid, uuid) to anon, authenticated;

alter table public.kelplantis_resource_nodes replica identity full;
do $$
begin
  alter publication supabase_realtime add table public.kelplantis_resource_nodes;
exception when duplicate_object then null;
end $$;

insert into public.kelplantis_resource_nodes (depth_id, resource_type, x, y, amount, max_amount)
select 1, 'kelp', v.x, v.y, 10, 10
from (values
  (4, 7),(9, 6),(14, 8),(26, 7),(32, 6),(36, 10),
  (5, 34),(10, 36),(16, 33),(25, 35),(31, 34),(36, 31)
) as v(x,y)
where not exists (
  select 1 from public.kelplantis_resource_nodes n
  where n.depth_id = 1 and n.resource_type = 'kelp' and n.x = v.x and n.y = v.y
);
