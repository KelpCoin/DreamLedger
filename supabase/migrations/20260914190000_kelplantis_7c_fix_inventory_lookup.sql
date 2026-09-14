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
  from public.kelplantis_players as p
  where p.player_token = p_player_token;
  if v_player_id is null then raise exception 'UNKNOWN_PLAYER'; end if;
  insert into public.kelplantis_player_inventory(player_id)
  values(v_player_id)
  on conflict on constraint kelplantis_player_inventory_pkey do nothing;
  return query
    select i.player_id,i.kelp,i.gold,i.pearls
    from public.kelplantis_player_inventory as i
    where i.player_id = v_player_id;
end;
$$;
revoke execute on function public.kelplantis_get_inventory_for_token(uuid) from public;
grant execute on function public.kelplantis_get_inventory_for_token(uuid) to anon, authenticated;
