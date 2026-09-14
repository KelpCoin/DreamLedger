create or replace function public.kelplantis_claim_parcel(p_player_id uuid, p_parcel_key text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_player public.kelplantis_players;
  v_parcel public.kelplantis_parcels;
begin
  select * into v_player from public.kelplantis_players where id=p_player_id for update;
  if not found then raise exception 'UNKNOWN_PLAYER'; end if;
  if exists (select 1 from public.kelplantis_parcels where owner_player_id=p_player_id) then raise exception 'PLAYER_ALREADY_HAS_PARCEL'; end if;
  update public.kelplantis_parcels
    set owner_player_id=p_player_id, claimed_at=now(), updated_at=now()
    where depth_id=1 and parcel_key=p_parcel_key and owner_player_id is null
    returning * into v_parcel;
  if v_parcel.id is null then raise exception 'PARCEL_UNAVAILABLE'; end if;
  insert into public.kelplantis_soul_anchors(player_id,parcel_id,tome_x,tome_y,echo_state,offline)
  values(p_player_id,v_parcel.id,v_parcel.x,v_parcel.y,
    jsonb_build_object('name',v_player.name,'title','New Arrival','scars','None','cosmetics','Default','soul','A new page in the Soul Tome.'),false)
  on conflict(player_id) do update set parcel_id=excluded.parcel_id,tome_x=excluded.tome_x,tome_y=excluded.tome_y,offline=false,updated_at=now();
  return jsonb_build_object('parcel_id',v_parcel.id,'parcel_key',v_parcel.parcel_key,'x',v_parcel.x,'y',v_parcel.y);
exception when unique_violation then raise exception 'PARCEL_UNAVAILABLE';
end;
$$;

create or replace function public.kelplantis_claim_parcel_for_token(p_player_token uuid, p_parcel_key text)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare v_player_id uuid;
begin
  select id into v_player_id from public.kelplantis_players where player_token=p_player_token;
  if v_player_id is null then raise exception 'UNKNOWN_PLAYER'; end if;
  return public.kelplantis_claim_parcel(v_player_id,p_parcel_key);
end;
$$;

create or replace function public.kelplantis_resolve_spawn(p_player_token uuid)
returns table(spawn_x integer, spawn_y integer, spawn_source text)
language plpgsql security definer set search_path to 'public'
as $$
declare v_player_id uuid; v_anchor public.kelplantis_soul_anchors;
begin
  select id into v_player_id from public.kelplantis_players where player_token=p_player_token;
  if v_player_id is null then raise exception 'UNKNOWN_PLAYER'; end if;
  select * into v_anchor from public.kelplantis_soul_anchors where player_id=v_player_id;
  if v_anchor.player_id is not null then return query select v_anchor.tome_x,v_anchor.tome_y,'SOUL_ANCHOR'; end if;
  return query select 20,20,'FOUNTAIN';
end;
$$;

create or replace function public.kelplantis_list_offline_soul_anchors()
returns table(player_id uuid, name text, title text, scars text, cosmetics text, soul text, x integer, y integer, inspection_count integer)
language sql security definer set search_path to 'public'
as $$
  select a.player_id,p.name,
    coalesce(t.title_display,a.echo_state->>'title','New Arrival'),
    coalesce(a.echo_state->>'scars','None'),
    coalesce(a.echo_state->>'cosmetics','Default'),
    coalesce(a.echo_state->>'soul','A new page in the Soul Tome.'),
    a.tome_x,a.tome_y,a.inspection_count
  from public.kelplantis_soul_anchors a
  join public.kelplantis_players p on p.id=a.player_id
  left join lateral (select title_display from public.kelplantis_player_titles where player_id=a.player_id order by updated_at desc limit 1) t on true
  where a.offline=true order by a.updated_at desc;
$$;

create or replace function public.kelplantis_set_soul_anchor_for_token(p_player_token uuid,p_offline boolean,p_echo_state jsonb,p_x integer,p_y integer)
returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare v_player_id uuid;
begin
  select id into v_player_id from public.kelplantis_players where player_token=p_player_token;
  if v_player_id is null then raise exception 'UNKNOWN_PLAYER'; end if;
  update public.kelplantis_soul_anchors set offline=p_offline,echo_state=coalesce(p_echo_state,'{}'::jsonb),tome_x=coalesce(p_x,tome_x),tome_y=coalesce(p_y,tome_y),updated_at=now() where player_id=v_player_id;
  if not found then raise exception 'NO_SOUL_ANCHOR'; end if;
  return jsonb_build_object('updated',true,'offline',p_offline);
end;
$$;

create or replace function public.kelplantis_inspect_soul_anchor(p_player_id uuid, p_inspector_player_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare a public.kelplantis_soul_anchors; p public.kelplantis_players; t public.kelplantis_player_titles;
begin
  if not exists(select 1 from public.kelplantis_players where id=p_inspector_player_id) then raise exception 'UNKNOWN_INSPECTOR'; end if;
  select * into a from public.kelplantis_soul_anchors where player_id=p_player_id and offline=true;
  if a.player_id is null then raise exception 'SOUL_ANCHOR_NOT_OFFLINE'; end if;
  select * into p from public.kelplantis_players where id=p_player_id;
  select * into t from public.kelplantis_player_titles where player_id=p_player_id order by updated_at desc limit 1;
  update public.kelplantis_soul_anchors set inspection_count=inspection_count+1,last_inspected_at=now(),updated_at=now() where player_id=p_player_id;
  return jsonb_build_object('name',p.name,'title',coalesce(t.title_display,a.echo_state->>'title','New Arrival'),'scars',coalesce(a.echo_state->>'scars','None'),'cosmetics',coalesce(a.echo_state->>'cosmetics','Default'),'soul',coalesce(a.echo_state->>'soul','A new page in the Soul Tome.'),'x',a.tome_x,'y',a.tome_y,'inspection_count',a.inspection_count+1);
end;
$$;

create or replace function public.kelplantis_inspect_soul_anchor_for_token(p_target_player_id uuid,p_inspector_token uuid)
returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare v_inspector_id uuid;
begin
  select id into v_inspector_id from public.kelplantis_players where player_token=p_inspector_token;
  if v_inspector_id is null then raise exception 'UNKNOWN_INSPECTOR'; end if;
  return public.kelplantis_inspect_soul_anchor(p_target_player_id,v_inspector_id);
end;
$$;
