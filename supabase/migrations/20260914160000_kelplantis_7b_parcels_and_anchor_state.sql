create table if not exists public.kelplantis_parcels (
  id uuid primary key default gen_random_uuid(),
  depth_id integer not null default 1,
  parcel_key text not null,
  x integer not null,
  y integer not null,
  owner_player_id uuid references public.kelplantis_players(id),
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(depth_id, parcel_key)
);

create unique index if not exists kelplantis_parcels_one_owner
  on public.kelplantis_parcels(owner_player_id)
  where owner_player_id is not null;

create table if not exists public.kelplantis_soul_anchors (
  player_id uuid primary key references public.kelplantis_players(id) on delete cascade,
  parcel_id uuid not null unique references public.kelplantis_parcels(id),
  tome_x integer not null,
  tome_y integer not null,
  echo_state jsonb not null default '{}'::jsonb,
  offline boolean not null default false,
  last_inspected_at timestamptz,
  inspection_count integer not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists kelplantis_soul_anchors_offline_idx
  on public.kelplantis_soul_anchors(offline) where offline = true;

insert into public.kelplantis_parcels(depth_id, parcel_key, x, y) values
  (1, 'P01', 7, 12), (1, 'P02', 12, 12),
  (1, 'P03', 28, 12), (1, 'P04', 33, 12),
  (1, 'P05', 7, 28), (1, 'P06', 12, 28),
  (1, 'P07', 28, 28), (1, 'P08', 33, 28)
on conflict (depth_id, parcel_key) do nothing;

alter table public.kelplantis_parcels enable row level security;
alter table public.kelplantis_soul_anchors enable row level security;

create or replace function public.kelplantis_claim_parcel(p_player_id uuid, p_parcel_key text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_parcel public.kelplantis_parcels; v_existing uuid;
begin
  select id into v_existing from kelplantis_parcels where owner_player_id = p_player_id;
  if v_existing is not null then raise exception 'PLAYER_ALREADY_HAS_PARCEL'; end if;
  update kelplantis_parcels
    set owner_player_id = p_player_id, claimed_at = now(), updated_at = now()
    where depth_id = 1 and parcel_key = p_parcel_key and owner_player_id is null
    returning * into v_parcel;
  if v_parcel.id is null then raise exception 'PARCEL_UNAVAILABLE'; end if;
  insert into kelplantis_soul_anchors(player_id, parcel_id, tome_x, tome_y, echo_state, offline)
    values (p_player_id, v_parcel.id, v_parcel.x, v_parcel.y,
      jsonb_build_object('name', (select name from kelplantis_players where id=p_player_id),
        'title','New Arrival','scars','None','cosmetics','Default','soul','A new page in the Soul Tome.'), false)
    on conflict(player_id) do update set parcel_id=excluded.parcel_id,
      tome_x=excluded.tome_x, tome_y=excluded.tome_y, offline=false, updated_at=now();
  return jsonb_build_object('parcel_id',v_parcel.id,'parcel_key',v_parcel.parcel_key,'x',v_parcel.x,'y',v_parcel.y);
end $$;

create or replace function public.kelplantis_set_soul_anchor(p_player_id uuid, p_offline boolean, p_echo_state jsonb, p_x integer, p_y integer)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  update kelplantis_soul_anchors set offline=p_offline, echo_state=coalesce(p_echo_state,'{}'::jsonb),
    tome_x=coalesce(p_x,tome_x), tome_y=coalesce(p_y,tome_y), updated_at=now()
    where player_id=p_player_id;
  return jsonb_build_object('updated',true);
end $$;

create or replace function public.kelplantis_inspect_soul_anchor(p_player_id uuid, p_inspector_player_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare a public.kelplantis_soul_anchors; p public.kelplantis_players; t public.kelplantis_player_titles;
begin
  select * into a from kelplantis_soul_anchors where player_id=p_player_id and offline=true;
  if a.player_id is null then raise exception 'SOUL_ANCHOR_NOT_OFFLINE'; end if;
  select * into p from kelplantis_players where id=p_player_id;
  select * into t from kelplantis_player_titles where player_id=p_player_id order by updated_at desc limit 1;
  update kelplantis_soul_anchors set inspection_count=inspection_count+1, last_inspected_at=now(), updated_at=now() where player_id=p_player_id;
  return jsonb_build_object('name',p.name,'title',coalesce(t.title_display,a.echo_state->>'title','New Arrival'),
    'scars',coalesce(a.echo_state->>'scars','None'),'cosmetics',coalesce(a.echo_state->>'cosmetics','Default'),
    'soul',coalesce(a.echo_state->>'soul','A new page in the Soul Tome.'),'x',a.tome_x,'y',a.tome_y);
end $$;
