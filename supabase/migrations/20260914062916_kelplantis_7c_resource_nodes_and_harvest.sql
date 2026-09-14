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
  check (amount <= max_amount)
);

create table if not exists public.kelplantis_player_inventory (
  player_id uuid primary key references public.kelplantis_players(id) on delete cascade,
  kelp integer not null default 0 check (kelp >= 0),
  gold integer not null default 0 check (gold >= 0),
  pearls integer not null default 0 check (pearls >= 0),
  updated_at timestamptz not null default now()
);

alter table public.kelplantis_resource_nodes enable row level security;
alter table public.kelplantis_player_inventory enable row level security;

drop policy if exists kelplantis_resource_nodes_select on public.kelplantis_resource_nodes;
create policy kelplantis_resource_nodes_select on public.kelplantis_resource_nodes for select to anon, authenticated using (true);

drop policy if exists kelplantis_player_inventory_select on public.kelplantis_player_inventory;
create policy kelplantis_player_inventory_select on public.kelplantis_player_inventory for select to anon, authenticated using (true);

insert into public.kelplantis_resource_nodes(resource_type,x,y) values
 ('kelp',4,7),('kelp',16,33),('kelp',36,10),('kelp',9,6),('kelp',32,6),('kelp',10,36),
 ('kelp',26,7),('kelp',31,34),('kelp',5,34),('kelp',14,8),('kelp',25,35),('kelp',36,31)
on conflict do nothing;

create or replace function public.kelplantis_harvest_resource_for_token(p_player_token uuid,p_node_id uuid)
returns table(resource_type text,yield_amount integer,remaining_amount integer,respawn_at timestamptz)
language plpgsql security definer set search_path=''
as $$
declare v_player public.kelplantis_players; v_node public.kelplantis_resource_nodes; v_yield integer; v_respawn timestamptz;
begin
 select * into v_player from public.kelplantis_players where player_token=p_player_token for update;
 if not found then raise exception 'UNKNOWN_PLAYER'; end if;
 select * into v_node from public.kelplantis_resource_nodes where id=p_node_id and depth_id=1 for update;
 if not found then raise exception 'RESOURCE_NODE_NOT_FOUND'; end if;
 if v_node.amount<=0 then
   if v_node.respawn_at is null or v_node.respawn_at>now() then raise exception 'RESOURCE_NODE_DEPLETED'; end if;
   update public.kelplantis_resource_nodes set amount=max_amount,respawn_at=null,updated_at=now() where id=v_node.id;
   v_node.amount:=v_node.max_amount;
 end if;
 v_yield:=least(5,v_node.amount);
 insert into public.kelplantis_player_inventory(player_id) values(v_player.id) on conflict(player_id) do nothing;
 if v_node.resource_type='kelp' then update public.kelplantis_player_inventory set kelp=kelp+v_yield,updated_at=now() where player_id=v_player.id;
 elsif v_node.resource_type='gold_vein' then update public.kelplantis_player_inventory set gold=gold+v_yield,updated_at=now() where player_id=v_player.id;
 elsif v_node.resource_type='pearl' then update public.kelplantis_player_inventory set pearls=pearls+v_yield,updated_at=now() where player_id=v_player.id;
 else raise exception 'UNSUPPORTED_RESOURCE_TYPE'; end if;
 v_respawn:=case when v_node.amount-v_yield<=0 then now()+interval '15 minutes' else v_node.respawn_at end;
 update public.kelplantis_resource_nodes set amount=amount-v_yield,respawn_at=v_respawn,depleted_count=depleted_count+case when amount-v_yield<=0 then 1 else 0 end,updated_at=now() where id=v_node.id;
 return query select v_node.resource_type,v_yield,greatest(v_node.amount-v_yield,0),v_respawn;
end;
$$;

revoke all on function public.kelplantis_harvest_resource_for_token(uuid,uuid) from public;
grant execute on function public.kelplantis_harvest_resource_for_token(uuid,uuid) to anon,authenticated,service_role;

alter publication supabase_realtime add table public.kelplantis_resource_nodes;
