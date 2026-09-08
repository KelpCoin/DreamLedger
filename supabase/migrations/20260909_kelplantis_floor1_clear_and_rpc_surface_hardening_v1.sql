create or replace function public.kelplantis_record_floor1_boss_clear(p_player_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_player public.kelplantis_players;
  v_progress public.kelplantis_floor_progression;
begin
  select * into v_player from public.kelplantis_players where id=p_player_id for update;
  if not found then raise exception 'unknown player'; end if;
  if not coalesce((v_player.floor_progress->'1'->>'bossDefeated')::boolean,false) then
    raise exception 'floor 1 boss clear is not established by authoritative combat state';
  end if;
  insert into public.kelplantis_floor_progression(player_id,highest_unlocked_floor,floor_clears)
  values(p_player_id,1,'{}'::jsonb)
  on conflict(player_id) do nothing;
  select * into v_progress from public.kelplantis_floor_progression where player_id=p_player_id for update;
  update public.kelplantis_floor_progression
  set highest_unlocked_floor=greatest(highest_unlocked_floor,2),
      floor_clears=jsonb_set(floor_clears,'{1}',coalesce(v_player.floor_progress->'1','{}'::jsonb),true),
      updated_at=now()
  where player_id=p_player_id;
end;
$function$;

revoke all on function public.kelplantis_apply_floor1_first_clear(uuid) from anon, authenticated;
revoke all on function public.kelplantis_record_floor1_boss_clear(uuid) from anon, authenticated;
revoke all on function public.kelplantis_create_player(text, integer) from public;
revoke all on function public.kelplantis_get_player(uuid) from public;
revoke all on function public.kelplantis_get_floor_gate(uuid, integer) from public;
revoke all on function public.kelplantis_get_floor_progress(uuid) from public;
revoke all on function public.kelplantis_get_world_state(text) from public;
revoke all on function public.kelplantis_move_player(uuid, integer, integer) from public;
revoke all on function public.kelplantis_enter_floor(uuid, integer) from public;
revoke all on function public.kelplantis_engage_encounter(uuid) from public;
revoke all on function public.kelplantis_attack(uuid) from public;
revoke all on function public.kelplantis_flee_encounter(uuid) from public;
revoke all on function public.kelplantis_talk_to_npc(uuid, text) from public;
revoke all on function public.kelplantis_equip_item(uuid, text) from public;

grant execute on function public.kelplantis_create_player(text, integer) to anon, authenticated;
grant execute on function public.kelplantis_get_player(uuid) to anon, authenticated;
grant execute on function public.kelplantis_get_floor_gate(uuid, integer) to anon, authenticated;
grant execute on function public.kelplantis_get_floor_progress(uuid) to anon, authenticated;
grant execute on function public.kelplantis_get_world_state(text) to anon, authenticated;
grant execute on function public.kelplantis_move_player(uuid, integer, integer) to anon, authenticated;
grant execute on function public.kelplantis_enter_floor(uuid, integer) to anon, authenticated;
grant execute on function public.kelplantis_engage_encounter(uuid) to anon, authenticated;
grant execute on function public.kelplantis_attack(uuid) to anon, authenticated;
grant execute on function public.kelplantis_flee_encounter(uuid) to anon, authenticated;
grant execute on function public.kelplantis_talk_to_npc(uuid, text) to anon, authenticated;
grant execute on function public.kelplantis_equip_item(uuid, text) to anon, authenticated;
