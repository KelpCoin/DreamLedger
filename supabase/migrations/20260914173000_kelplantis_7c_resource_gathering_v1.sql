-- Kelplantis Domino 7C: corrected world-resource and inventory foundation.
-- Canon: parcels are homes; wild nodes are world resources; harvesting is authoritative.
-- Depth 1 contains common kelp only. Rare resources remain for deeper content.

create table if not exists public.kelplantis_resource_nodes (
  id uuid primary key default gen_random_uuid(),
  depth_id integer not null default 1,
  resource_type text not null,
  x integer not null,
  y integer not null,
  amount integer not null default 10,
  max_amount integer not null default 10,
  respawn_at timestamptz,
  depleted_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kelplantis_resource_nodes_amount_check check (amount >= 0),
  constraint kelplantis_resource_nodes_max_amount_check check (max_amount > 0),
  constraint kelplantis_resource_nodes_position_ck check (x >= 0 and y >= 0),
  constraint kelplantis_resource_nodes_depleted_count_check check (depleted_count >= 0),
  constraint kelplantis_resource_nodes_type_ck check (resource_type in ('kelp','gold_vein','pearl'))
);

create index if not exists kelplantis_resource_nodes_depth_idx
  on public.kelplantis_resource_nodes(depth_id, resource_type);

create table if not exists public.kelplantis_player_inventory (
  player_id uuid primary key references public.kelplantis_players(id) on delete cascade,
  kelp integer not null default 0 check (kelp >= 0),
  gold integer not null default 0 check (gold >= 0),
  pearls integer not null default 0 check (pearls >= 0),
  updated_at timestamptz not null default now()
);

alter table public.kelplantis_resource_nodes enable row level security;
alter table public.kelplantis_player_inventory enable row level security;

grant select on public.kelplantis_resource_nodes to anon, authenticated;

drop policy if exists "kelplantis resource nodes public read" on public.kelplantis_resource_nodes;
drop policy if exists kelplantis_resource_nodes_select on public.kelplantis_resource_nodes;
create policy kelplantis_resource_nodes_select
  on public.kelplantis_resource_nodes
  for select to anon, authenticated
  using (true);

drop policy if exists kelplantis_player_inventory_select on public.kelplantis_player_inventory;

create or replace function public.kelplantis_get_inventory_for_token(p_player_token uuid)
returns table(player_id uuid, kelp integer, gold integer, pearls integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player_id uuid;
begin
  select p.id into v_player_id
  from public.kelplantis_players p
  where p.player_token = p_player_token;
  if v_player_id is null then raise exception 'UNKNOWN_PLAYER'; end if;
  insert into public.kelplantis_player_inventory(player_id)
  values(v_player_id)
  on conflict(player_id) do nothing;
  return query
    select i.player_id, i.kelp, i.gold, i.pearls
    from public.kelplantis_player_inventory i
    where i.player_id = v_player_id;
end;
$$;

create or replace function public.kelplantis_harvest_resource_for_token(
  p_player_token uuid,
  p_node_id uuid
)
returns table(resource_type text, yield_amount integer, remaining_amount integer, respawn_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player public.kelplantis_players;
  v_node public.kelplantis_resource_nodes;
  v_yield integer;
  v_respawn timestamptz;
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

  if v_node.amount <= 0 then
    if v_node.respawn_at is null or v_node.respawn_at > now() then
      raise exception 'RESOURCE_NODE_DEPLETED';
    end if;
    update public.kelplantis_resource_nodes
      set amount = max_amount, respawn_at = null, updated_at = now()
      where id = v_node.id;
    v_node.amount := v_node.max_amount;
  end if;

  v_yield := least(5, v_node.amount);
  insert into public.kelplantis_player_inventory(player_id)
    values(v_player.id)
    on conflict(player_id) do nothing;

  if v_node.resource_type = 'kelp' then
    update public.kelplantis_player_inventory
      set kelp = kelp + v_yield, updated_at = now()
      where player_id = v_player.id;
  elsif v_node.resource_type = 'gold_vein' then
    update public.kelplantis_player_inventory
      set gold = gold + v_yield, updated_at = now()
      where player_id = v_player.id;
  elsif v_node.resource_type = 'pearl' then
    update public.kelplantis_player_inventory
      set pearls = pearls + v_yield, updated_at = now()
      where player_id = v_player.id;
  else
    raise exception 'UNSUPPORTED_RESOURCE_TYPE';
  end if;

  v_respawn := case
    when v_node.amount - v_yield <= 0
      then now() + interval '15 minutes'
    else v_node.respawn_at
  end;

  update public.kelplantis_resource_nodes
    set amount = amount - v_yield,
        respawn_at = v_respawn,
        depleted_count = depleted_count + case when amount - v_yield <= 0 then 1 else 0 end,
        updated_at = now()
    where id = v_node.id;

  return query
    select v_node.resource_type,
           v_yield,
           greatest(v_node.amount - v_yield, 0),
           v_respawn;
end;
$$;

revoke all on function public.kelplantis_get_inventory_for_token(uuid) from public;
grant execute on function public.kelplantis_get_inventory_for_token(uuid) to anon, authenticated;
revoke all on function public.kelplantis_harvest_resource_for_token(uuid, uuid) from public;
grant execute on function public.kelplantis_harvest_resource_for_token(uuid, uuid) to anon, authenticated;

do $$
begin
  if exists(select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists(select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'kelplantis_player_inventory') then
    alter publication supabase_realtime add table public.kelplantis_player_inventory;
  end if;
end
$$;

insert into public.kelplantis_resource_nodes(depth_id,resource_type,x,y,amount,max_amount)
select v.depth_id,v.resource_type,v.x,v.y,10,10
from (values
  (1,'kelp',5,8),(1,'kelp',10,7),(1,'kelp',15,9),(1,'kelp',25,8),
  (1,'kelp',30,10),(1,'kelp',35,7),(1,'kelp',6,30),(1,'kelp',12,33),
  (1,'kelp',28,31),(1,'kelp',34,29),(1,'kelp',8,22),(1,'kelp',32,22)
) v(depth_id,resource_type,x,y)
where not exists (
  select 1 from public.kelplantis_resource_nodes n
  where n.depth_id=v.depth_id and n.resource_type=v.resource_type
    and n.x=v.x and n.y=v.y
);
