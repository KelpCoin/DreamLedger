-- Kelplantis 7B/7C live-state reconciliation.
-- Durable state stays in Postgres. Movement/chat/emotes use Realtime Broadcast.
-- Presence is identity/online state only.

create table if not exists public.kelplantis_resource_nodes (
  id uuid primary key default gen_random_uuid(),
  depth_id integer not null default 1,
  resource_type text not null check (resource_type in ('kelp','gold_vein','pearl')),
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
create policy kelplantis_resource_nodes_select on public.kelplantis_resource_nodes
  for select to anon, authenticated using (true);

drop policy if exists kelplantis_player_inventory_select on public.kelplantis_player_inventory;
create policy kelplantis_player_inventory_select on public.kelplantis_player_inventory
  for select to anon, authenticated using (false);

insert into public.kelplantis_resource_nodes(resource_type,x,y) values
 ('kelp',4,7),('kelp',16,33),('kelp',36,10),('kelp',9,6),('kelp',32,6),('kelp',10,36),
 ('kelp',26,7),('kelp',31,34),('kelp',5,34),('kelp',14,8),('kelp',25,35),('kelp',36,31)
on conflict do nothing;

create or replace function public.kelplantis_get_inventory_for_token(p_player_token uuid)
returns table(player_id uuid, kelp integer, gold integer, pearls integer)
language sql security definer set search_path = '' as $$
  select i.player_id,i.kelp,i.gold,i.pearls
  from public.kelplantis_player_inventory i
  join public.kelplantis_players p on p.id=i.player_id
  where p.player_token=p_player_token;
$$;

create or replace function public.kelplantis_harvest_resource_for_token(p_player_token uuid,p_node_id uuid)
returns table(resource_type text,yield_amount integer,remaining_amount integer,respawn_at timestamptz)
language plpgsql security definer set search_path = '' as $$
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
  if v_node.resource_type='kelp' then
    update public.kelplantis_player_inventory set kelp=kelp+v_yield,updated_at=now() where player_id=v_player.id;
  elsif v_node.resource_type='gold_vein' then
    update public.kelplantis_player_inventory set gold=gold+v_yield,updated_at=now() where player_id=v_player.id;
  elsif v_node.resource_type='pearl' then
    update public.kelplantis_player_inventory set pearls=pearls+v_yield,updated_at=now() where player_id=v_player.id;
  else raise exception 'UNSUPPORTED_RESOURCE_TYPE'; end if;
  v_respawn:=case when v_node.amount-v_yield<=0 then now()+interval '15 minutes' else v_node.respawn_at end;
  update public.kelplantis_resource_nodes set amount=amount-v_yield,respawn_at=v_respawn,depleted_count=depleted_count+case when amount-v_yield<=0 then 1 else 0 end,updated_at=now() where id=v_node.id;
  return query select v_node.resource_type,v_yield,greatest(v_node.amount-v_yield,0),v_respawn;
end;
$$;

create or replace function public.kelplantis_broadcast_resource_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform realtime.send(
    jsonb_build_object(
      'table',TG_TABLE_NAME,
      'schema',TG_TABLE_SCHEMA,
      'type',TG_OP,
      'record',case when TG_OP='DELETE' then null else to_jsonb(NEW) end,
      'old_record',case when TG_OP='INSERT' then null else to_jsonb(OLD) end
    ),
    'resource_updated',
    'kelplantis-depth-1',
    false
  );
  return case when TG_OP='DELETE' then OLD else NEW end;
end;
$$;

drop trigger if exists kelplantis_resource_nodes_broadcast on public.kelplantis_resource_nodes;
create trigger kelplantis_resource_nodes_broadcast
after insert or update or delete on public.kelplantis_resource_nodes
for each row execute function public.kelplantis_broadcast_resource_change();

do $$
begin
  if exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='kelplantis_resource_nodes') then
    alter publication supabase_realtime drop table public.kelplantis_resource_nodes;
  end if;
  if exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='kelplantis_player_inventory') then
    alter publication supabase_realtime drop table public.kelplantis_player_inventory;
  end if;
end;
$$;

-- Harden 7B token-bound RPCs. All names are schema-qualified under an empty search_path.
create or replace function public.kelplantis_claim_parcel_for_token(p_player_token uuid,p_parcel_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_player_id uuid;
begin
  select id into v_player_id from public.kelplantis_players where player_token=p_player_token;
  if v_player_id is null then raise exception 'UNKNOWN_PLAYER'; end if;
  return public.kelplantis_claim_parcel(v_player_id,p_parcel_key);
end;
$$;

create or replace function public.kelplantis_set_soul_anchor_for_token(p_player_token uuid,p_offline boolean,p_echo_state jsonb,p_x integer,p_y integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_player_id uuid;
begin
  select id into v_player_id from public.kelplantis_players where player_token=p_player_token;
  if v_player_id is null then raise exception 'UNKNOWN_PLAYER'; end if;
  update public.kelplantis_soul_anchors set offline=p_offline,echo_state=coalesce(p_echo_state,'{}'::jsonb),tome_x=coalesce(p_x,tome_x),tome_y=coalesce(p_y,tome_y),updated_at=now() where player_id=v_player_id;
  if not found then raise exception 'NO_SOUL_ANCHOR'; end if;
  return jsonb_build_object('updated',true,'offline',p_offline);
end;
$$;

create or replace function public.kelplantis_resolve_spawn(p_player_token uuid)
returns table(spawn_x integer,spawn_y integer,spawn_source text)
language plpgsql security definer set search_path = '' as $$
declare v_player_id uuid; v_anchor public.kelplantis_soul_anchors;
begin
  select id into v_player_id from public.kelplantis_players where player_token=p_player_token;
  if v_player_id is null then raise exception 'UNKNOWN_PLAYER'; end if;
  select * into v_anchor from public.kelplantis_soul_anchors where player_id=v_player_id;
  if v_anchor.player_id is not null then return query select v_anchor.tome_x,v_anchor.tome_y,'SOUL_ANCHOR'; end if;
  return query select 20,20,'FOUNTAIN';
end;
$$;

create or replace function public.kelplantis_inspect_soul_anchor_for_token(p_target_player_id uuid,p_inspector_token uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_inspector_id uuid;
begin
  select id into v_inspector_id from public.kelplantis_players where player_token=p_inspector_token;
  if v_inspector_id is null then raise exception 'UNKNOWN_INSPECTOR'; end if;
  return public.kelplantis_inspect_soul_anchor(p_target_player_id,v_inspector_id);
end;
$$;

create or replace function public.kelplantis_list_offline_soul_anchors()
returns table(player_id uuid,name text,title text,scars text,cosmetics text,soul text,x integer,y integer,inspection_count integer)
language sql security definer set search_path = '' as $$
  select a.player_id,p.name,coalesce(t.title_display,a.echo_state->>'title','New Arrival'),coalesce(a.echo_state->>'scars','None'),coalesce(a.echo_state->>'cosmetics','Default'),coalesce(a.echo_state->>'soul','A new page in the Soul Tome.'),a.tome_x,a.tome_y,a.inspection_count
  from public.kelplantis_soul_anchors a
  join public.kelplantis_players p on p.id=a.player_id
  left join lateral (select title_display from public.kelplantis_player_titles where player_id=a.player_id order by updated_at desc limit 1) t on true
  where a.offline=true order by a.updated_at desc;
$$;

create or replace function public.kelplantis_claim_parcel(p_player_id uuid,p_parcel_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_player public.kelplantis_players; v_parcel public.kelplantis_parcels;
begin
  select * into v_player from public.kelplantis_players where id=p_player_id for update;
  if not found then raise exception 'UNKNOWN_PLAYER'; end if;
  if exists (select 1 from public.kelplantis_parcels where owner_player_id=p_player_id) then raise exception 'PLAYER_ALREADY_HAS_PARCEL'; end if;
  update public.kelplantis_parcels set owner_player_id=p_player_id,claimed_at=now(),updated_at=now() where depth_id=1 and parcel_key=p_parcel_key and owner_player_id is null returning * into v_parcel;
  if v_parcel.id is null then raise exception 'PARCEL_UNAVAILABLE'; end if;
  insert into public.kelplantis_soul_anchors(player_id,parcel_id,tome_x,tome_y,echo_state,offline)
  values(p_player_id,v_parcel.id,v_parcel.x,v_parcel.y,jsonb_build_object('name',v_player.name,'title','New Arrival','scars','None','cosmetics','Default','soul','A new page in the Soul Tome.'),false)
  on conflict(player_id) do update set parcel_id=excluded.parcel_id,tome_x=excluded.tome_x,tome_y=excluded.tome_y,offline=false,updated_at=now();
  return jsonb_build_object('parcel_id',v_parcel.id,'parcel_key',v_parcel.parcel_key,'x',v_parcel.x,'y',v_parcel.y);
exception when unique_violation then raise exception 'PARCEL_UNAVAILABLE';
end;
$$;

revoke all on function public.kelplantis_harvest_resource_for_token(uuid,uuid) from public;
grant execute on function public.kelplantis_harvest_resource_for_token(uuid,uuid) to anon,authenticated,service_role;
revoke all on function public.kelplantis_get_inventory_for_token(uuid) from public;
grant execute on function public.kelplantis_get_inventory_for_token(uuid) to anon,authenticated,service_role;
revoke all on function public.kelplantis_claim_parcel(uuid,text) from public;
grant execute on function public.kelplantis_claim_parcel(uuid,text) to anon,authenticated,service_role;
revoke all on function public.kelplantis_claim_parcel_for_token(uuid,text) from public;
grant execute on function public.kelplantis_claim_parcel_for_token(uuid,text) to anon,authenticated,service_role;
revoke all on function public.kelplantis_set_soul_anchor_for_token(uuid,boolean,jsonb,integer,integer) from public;
grant execute on function public.kelplantis_set_soul_anchor_for_token(uuid,boolean,jsonb,integer,integer) to anon,authenticated,service_role;
revoke all on function public.kelplantis_resolve_spawn(uuid) from public;
grant execute on function public.kelplantis_resolve_spawn(uuid) to anon,authenticated,service_role;
revoke all on function public.kelplantis_inspect_soul_anchor_for_token(uuid,uuid) from public;
grant execute on function public.kelplantis_inspect_soul_anchor_for_token(uuid,uuid) to anon,authenticated,service_role;
revoke all on function public.kelplantis_list_offline_soul_anchors() from public;
grant execute on function public.kelplantis_list_offline_soul_anchors() to anon,authenticated,service_role;
