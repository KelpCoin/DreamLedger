create table if not exists public.x402_replay_reservations (
  replay_key text primary key,
  resource text not null,
  reservation_token text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  released_at timestamptz null
);

create index if not exists x402_replay_reservations_expires_idx
  on public.x402_replay_reservations (expires_at);

alter table public.x402_replay_reservations enable row level security;
revoke all on public.x402_replay_reservations from anon, authenticated;

create or replace function public.x402_replay_reserve(
  p_replay_key text,
  p_resource text,
  p_reservation_token text,
  p_expires_at timestamptz
) returns text
language plpgsql
security invoker
as $$
declare
  v_token text;
begin
  insert into public.x402_replay_reservations(
    replay_key, resource, reservation_token, expires_at
  ) values (
    p_replay_key, p_resource, p_reservation_token, p_expires_at
  )
  on conflict (replay_key) do update
    set resource = excluded.resource,
        reservation_token = excluded.reservation_token,
        expires_at = excluded.expires_at,
        created_at = now(),
        released_at = null
    where public.x402_replay_reservations.expires_at <= now()
  returning reservation_token into v_token;

  if v_token = p_reservation_token then
    return 'RESERVED';
  end if;

  if exists (
    select 1 from public.x402_replay_reservations
    where replay_key = p_replay_key
      and resource <> p_resource
      and expires_at > now()
  ) then
    return 'RESOURCE_MISMATCH';
  end if;

  return 'ALREADY_RESERVED';
end;
$$;

create or replace function public.x402_replay_release(
  p_replay_key text,
  p_reservation_token text
) returns boolean
language sql
security invoker
as $$
  update public.x402_replay_reservations
  set released_at = now()
  where replay_key = p_replay_key
    and reservation_token = p_reservation_token
    and expires_at > now()
    and released_at is null
  returning true;
$$;

revoke execute on function public.x402_replay_reserve(text,text,text,timestamptz) from public, anon, authenticated;
revoke execute on function public.x402_replay_release(text,text) from public, anon, authenticated;
