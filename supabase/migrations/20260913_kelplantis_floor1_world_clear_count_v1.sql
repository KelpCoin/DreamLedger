create or replace function public.kelplantis_apply_floor1_first_clear(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_player public.kelplantis_players;
  v_state jsonb;
  v_version bigint;
  v_total integer;
begin
  select * into v_player from public.kelplantis_players where player_token = p_token for update;
  if not found then raise exception 'unknown player_token'; end if;
  if not exists (select 1 from public.kelplantis_soul_events where player_id=v_player.id and event_type='FLOOR_BOSS_DEFEATED' and floor_id=1 and verified=true) then
    raise exception 'floor 1 boss not established by canonical event history';
  end if;
  select state,version into v_state,v_version from public.kelplantis_world_state where world_key='floor1' for update;
  if not found then raise exception 'floor1 world state missing'; end if;
  if coalesce(v_state->>'garden_state','') <> 'changed_after_first_clear' then
    v_total:=coalesce((v_state->>'total_boss_clears')::int,0)+1;
    v_state:=v_state||jsonb_build_object('garden_state','changed_after_first_clear','town_mood','celebratory','rumour','The Sprout King has fallen. The garden is opening its old paths.','warden_state','honoured','first_clear_player',v_player.name,'changed_by_event','floor1_boss_first_clear','total_boss_clears',v_total);
    update public.kelplantis_world_state set state=v_state,version=v_version+1,updated_at=now() where world_key='floor1';
    insert into public.kelplantis_events(player_token,event_type,payload) values(p_token,'world_state_changed',jsonb_build_object('world_key','floor1','version',v_version+1,'trigger','floor1_boss_first_clear','total_boss_clears',v_total));
  end if;
  return public.kelplantis_get_world_state('floor1');
end;
$function$;