-- PhinHaven Stage 0: hotel rooms, presence, chat
-- Guest-token identity (no combat/economy). Apply on Supabase when ready.
-- Status after apply: UNVERIFIED until dual-session proof exists.

create table if not exists public.ph_rooms (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  kind text not null check (kind in ('lobby', 'hotel', 'private')),
  owner_guest_id uuid null,
  capacity integer not null default 20 check (capacity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ph_guests (
  id uuid primary key default gen_random_uuid(),
  guest_token uuid not null unique default gen_random_uuid(),
  display_name text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists public.ph_presence (
  guest_id uuid primary key references public.ph_guests(id) on delete cascade,
  room_id uuid not null references public.ph_rooms(id),
  status text not null default 'online' check (status in ('online', 'away', 'offline')),
  last_seen_at timestamptz not null default now()
);

create table if not exists public.ph_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.ph_rooms(id) on delete cascade,
  guest_id uuid not null references public.ph_guests(id) on delete cascade,
  body text not null check (char_length(body) > 0 and char_length(body) <= 500),
  created_at timestamptz not null default now()
);

create index if not exists ph_messages_room_created_idx
  on public.ph_messages(room_id, created_at desc);

create index if not exists ph_presence_room_idx
  on public.ph_presence(room_id);

-- Seed lobby + a few hotel rooms
insert into public.ph_rooms (slug, title, kind, capacity) values
  ('lobby', 'Lobby', 'lobby', 100),
  ('room-01', 'Room 01', 'hotel', 4),
  ('room-02', 'Room 02', 'hotel', 4),
  ('room-03', 'Room 03', 'hotel', 4),
  ('room-04', 'Room 04', 'hotel', 4),
  ('room-05', 'Room 05', 'hotel', 4),
  ('room-06', 'Room 06', 'hotel', 4),
  ('room-07', 'Room 07', 'hotel', 4),
  ('room-08', 'Room 08', 'hotel', 4)
on conflict (slug) do nothing;

alter table public.ph_rooms enable row level security;
alter table public.ph_guests enable row level security;
alter table public.ph_presence enable row level security;
alter table public.ph_messages enable row level security;

-- Read-mostly policies for Stage 0 (tighten when auth is wired)
drop policy if exists ph_rooms_select on public.ph_rooms;
create policy ph_rooms_select on public.ph_rooms for select to anon, authenticated using (true);

drop policy if exists ph_presence_select on public.ph_presence;
create policy ph_presence_select on public.ph_presence for select to anon, authenticated using (true);

drop policy if exists ph_messages_select on public.ph_messages;
create policy ph_messages_select on public.ph_messages for select to anon, authenticated using (true);

-- Guests: no direct table writes from client; use RPCs

create or replace function public.ph_register_guest(p_display_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := left(trim(coalesce(p_display_name, '')), 32);
  v_guest public.ph_guests;
begin
  if v_name is null or v_name = '' then
    v_name := 'Guest-' || substr(gen_random_uuid()::text, 1, 8);
  end if;
  insert into public.ph_guests(display_name)
    values (v_name)
    returning * into v_guest;
  return jsonb_build_object(
    'guest_id', v_guest.id,
    'guest_token', v_guest.guest_token,
    'display_name', v_guest.display_name
  );
end;
$$;

create or replace function public.ph_enter_room(p_guest_token uuid, p_room_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guest public.ph_guests;
  v_room public.ph_rooms;
  v_count integer;
begin
  select * into v_guest from public.ph_guests where guest_token = p_guest_token for update;
  if not found then raise exception 'UNKNOWN_GUEST'; end if;

  select * into v_room from public.ph_rooms where slug = p_room_slug for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;

  select count(*) into v_count from public.ph_presence
    where room_id = v_room.id and status = 'online' and last_seen_at > now() - interval '2 minutes';
  if v_count >= v_room.capacity then
    raise exception 'ROOM_FULL';
  end if;

  update public.ph_guests set last_seen_at = now() where id = v_guest.id;

  insert into public.ph_presence(guest_id, room_id, status, last_seen_at)
    values (v_guest.id, v_room.id, 'online', now())
    on conflict (guest_id) do update
      set room_id = excluded.room_id, status = 'online', last_seen_at = now();

  -- hotel claim: first entrant becomes owner if hotel and unowned
  if v_room.kind = 'hotel' and v_room.owner_guest_id is null then
    update public.ph_rooms
      set owner_guest_id = v_guest.id, updated_at = now()
      where id = v_room.id and owner_guest_id is null;
  end if;

  return jsonb_build_object(
    'room_id', v_room.id,
    'slug', v_room.slug,
    'title', v_room.title,
    'kind', v_room.kind
  );
end;
$$;

create or replace function public.ph_heartbeat(p_guest_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guest public.ph_guests;
begin
  select * into v_guest from public.ph_guests where guest_token = p_guest_token;
  if not found then raise exception 'UNKNOWN_GUEST'; end if;
  update public.ph_guests set last_seen_at = now() where id = v_guest.id;
  update public.ph_presence set last_seen_at = now(), status = 'online' where guest_id = v_guest.id;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.ph_post_message(p_guest_token uuid, p_room_slug text, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guest public.ph_guests;
  v_room public.ph_rooms;
  v_msg public.ph_messages;
  v_body text := left(trim(coalesce(p_body, '')), 500);
  v_recent integer;
begin
  if v_body is null or v_body = '' then raise exception 'EMPTY_BODY'; end if;

  select * into v_guest from public.ph_guests where guest_token = p_guest_token;
  if not found then raise exception 'UNKNOWN_GUEST'; end if;

  select * into v_room from public.ph_rooms where slug = p_room_slug;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;

  -- must be present in room (soft: last 2 min)
  if not exists (
    select 1 from public.ph_presence
    where guest_id = v_guest.id and room_id = v_room.id
      and last_seen_at > now() - interval '2 minutes'
  ) then
    raise exception 'NOT_IN_ROOM';
  end if;

  -- simple rate limit: max 10 messages / 30s
  select count(*) into v_recent from public.ph_messages
    where guest_id = v_guest.id and created_at > now() - interval '30 seconds';
  if v_recent >= 10 then raise exception 'RATE_LIMIT'; end if;

  insert into public.ph_messages(room_id, guest_id, body)
    values (v_room.id, v_guest.id, v_body)
    returning * into v_msg;

  update public.ph_guests set last_seen_at = now() where id = v_guest.id;
  update public.ph_presence set last_seen_at = now() where guest_id = v_guest.id;

  return jsonb_build_object(
    'message_id', v_msg.id,
    'room_id', v_msg.room_id,
    'body', v_msg.body,
    'created_at', v_msg.created_at,
    'display_name', v_guest.display_name
  );
end;
$$;

create or replace function public.ph_list_room_state(p_room_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.ph_rooms;
  v_presence jsonb;
  v_messages jsonb;
begin
  select * into v_room from public.ph_rooms where slug = p_room_slug;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'guest_id', g.id,
      'display_name', g.display_name,
      'status', p.status,
      'last_seen_at', p.last_seen_at
    ) order by g.display_name), '[]'::jsonb)
    into v_presence
  from public.ph_presence p
  join public.ph_guests g on g.id = p.guest_id
  where p.room_id = v_room.id
    and p.last_seen_at > now() - interval '2 minutes';

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', m.id,
      'body', m.body,
      'display_name', g.display_name,
      'created_at', m.created_at
    ) order by m.created_at), '[]'::jsonb)
    into v_messages
  from (
    select * from public.ph_messages
    where room_id = v_room.id
    order by created_at desc
    limit 50
  ) m
  join public.ph_guests g on g.id = m.guest_id;

  return jsonb_build_object(
    'room', jsonb_build_object(
      'id', v_room.id,
      'slug', v_room.slug,
      'title', v_room.title,
      'kind', v_room.kind,
      'capacity', v_room.capacity
    ),
    'presence', v_presence,
    'messages', v_messages
  );
end;
$$;

revoke all on function public.ph_register_guest(text) from public;
revoke all on function public.ph_enter_room(uuid, text) from public;
revoke all on function public.ph_heartbeat(uuid) from public;
revoke all on function public.ph_post_message(uuid, text, text) from public;
revoke all on function public.ph_list_room_state(text) from public;

grant execute on function public.ph_register_guest(text) to anon, authenticated, service_role;
grant execute on function public.ph_enter_room(uuid, text) to anon, authenticated, service_role;
grant execute on function public.ph_heartbeat(uuid) to anon, authenticated, service_role;
grant execute on function public.ph_post_message(uuid, text, text) to anon, authenticated, service_role;
grant execute on function public.ph_list_room_state(text) to anon, authenticated, service_role;
