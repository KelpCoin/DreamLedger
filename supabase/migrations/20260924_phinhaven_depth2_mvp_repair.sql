-- PHINHAVEN: restore canonical legacy RPC compatibility and make Depth 2 playable
-- Applied to Supabase project wbwgroygjeyukkspnqiy on 2026-09-24.
-- This migration is a record of the live repair. It is not re-applied here.

create or replace view public.kelplantis_players as select * from public.phinhaven_players;
create or replace view public.kelplantis_events as select * from public.phinhaven_events;
create or replace view public.kelplantis_floor_progression as select * from public.phinhaven_floor_progression;
create or replace view public.kelplantis_world_state as select * from public.phinhaven_world_state;
create or replace view public.kelplantis_soul_events as select * from public.phinhaven_soul_events;
create or replace view public.kelplantis_soul_anchors as select * from public.phinhaven_soul_anchors;
create or replace view public.kelplantis_content_bank as select * from public.phinhaven_content_bank;
create or replace view public.kelplantis_cosmetic_ownership as select * from public.phinhaven_cosmetic_ownership;
create or replace view public.kelplantis_cosmetics as select * from public.phinhaven_cosmetics;
create or replace view public.kelplantis_differentiators as select * from public.phinhaven_differentiators;
create or replace view public.kelplantis_quests as select * from public.phinhaven_quests;
create or replace view public.kelplantis_floor_gates as select * from public.phinhaven_floor_gates;

revoke all on public.kelplantis_players, public.kelplantis_events, public.kelplantis_floor_progression,
 public.kelplantis_world_state, public.kelplantis_soul_events, public.kelplantis_soul_anchors,
 public.kelplantis_content_bank, public.kelplantis_cosmetic_ownership, public.kelplantis_cosmetics,
 public.kelplantis_differentiators, public.kelplantis_quests, public.kelplantis_floor_gates
from anon, authenticated;

update public.phinhaven_floor_specs
set status='CANON',
    description='First dangerous expedition Depth. Introduces meaningful resource scarcity and the first possibility of guild strategic influence.',
    updated_at=now()
where floor_id=2;

create or replace function public.kelplantis_enter_floor(p_token uuid, p_floor_id integer)
returns public.phinhaven_players
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_player public.phinhaven_players;
  v_floor public.phinhaven_floor_specs;
  v_gate public.phinhaven_floor_gates;
  v_unlocked boolean;
  v_state jsonb;
begin
  select * into v_player from public.phinhaven_players where player_token=p_token for update;
  if not found then raise exception 'unknown player_token'; end if;
  if p_floor_id < 1 or p_floor_id > 100 then raise exception 'invalid floor'; end if;
  select * into v_floor from public.phinhaven_floor_specs where floor_id=p_floor_id;
  if not found then raise exception 'floor % is not instantiated',p_floor_id; end if;
  select * into v_gate from public.phinhaven_floor_gates where floor_id=p_floor_id;

  if p_floor_id = 1 then
    v_unlocked := true;
  elsif v_gate.floor_id is null then
    v_unlocked := false;
  else
    v_unlocked := exists (
      select 1 from public.phinhaven_soul_events se
      where se.player_id=v_player.id
        and se.floor_id=v_gate.required_previous_floor
        and se.event_type=v_gate.required_clear_event_type
        and se.verified=true
        and coalesce(se.payload->>'boss_key','')=coalesce(v_gate.required_boss_key,'')
    );
  end if;

  if not v_unlocked then raise exception 'depth % is locked: defeat the canonical Depth % boss first',p_floor_id,v_gate.required_previous_floor; end if;
  if v_floor.status <> 'CANON' then raise exception 'depth % is unlocked but not yet playable',p_floor_id; end if;

  if p_floor_id = 1 then
    update public.phinhaven_players
    set scene='DUNGEON',pos_x=0,pos_y=0,dungeon_state=public.kelplantis__gen_floor1_dungeon(),current_encounter=null,updated_at=now()
    where id=v_player.id returning * into v_player;
  elsif p_floor_id = 2 then
    v_state := jsonb_build_object(
      'floor_id',2,'room_index',0,
      'rooms',jsonb_build_array(
        jsonb_build_object('type','encounter','cleared',false,'enemy_hp',18,'enemy_atk',4,'enemy_key','frontier_stalker','enemy_name','Frontier Stalker','enemy_max_hp',18,'room_modifier','mossy_floor'),
        jsonb_build_object('type','encounter','cleared',false,'enemy_hp',22,'enemy_atk',5,'enemy_key','thorn_watcher','enemy_name','Thorn Watcher','enemy_max_hp',22,'room_modifier','root_tangle'),
        jsonb_build_object('type','encounter','cleared',false,'enemy_hp',26,'enemy_atk',5,'enemy_key','depth_hunter','enemy_name','Depth Hunter','enemy_max_hp',26,'enemy_max_hp',26,'room_modifier','fungal_glow')
      )
    );
    update public.phinhaven_players
    set scene='DUNGEON',pos_x=0,pos_y=0,dungeon_state=v_state,current_encounter=null,updated_at=now()
    where id=v_player.id returning * into v_player;
  end if;

  insert into public.phinhaven_events(player_token,event_type,payload)
  values(p_token,'floor_entered',jsonb_build_object('floor_id',p_floor_id));
  return v_player;
end;
$function$;

create or replace function public.kelplantis_exit_floor(p_token uuid)
returns public.phinhaven_players
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_player public.phinhaven_players;
  v_floor_id int;
begin
  select * into v_player from public.phinhaven_players where player_token=p_token for update;
  if not found then raise exception 'unknown player_token'; end if;
  if v_player.scene <> 'DUNGEON' then raise exception 'not in a dungeon'; end if;
  v_floor_id := coalesce((v_player.dungeon_state->>'floor_id')::int,1);
  update public.phinhaven_players
  set scene='TOWN',pos_x=2,pos_y=1,dungeon_state=null,current_encounter=null,updated_at=now()
  where id=v_player.id returning * into v_player;
  insert into public.phinhaven_events(player_token,event_type,payload)
  values(p_token,'floor_exited',jsonb_build_object('floor_id',v_floor_id));
  return v_player;
end;
$function$;