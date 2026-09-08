alter table public.kelplantis_players
  alter column hp set default 100,
  alter column max_hp set default 100,
  alter column atk set default 22;

create or replace function public.kelplantis_create_player(p_name text, p_color_hue integer)
returns public.kelplantis_players
language plpgsql security definer set search_path=public
as $function$
declare v_row public.kelplantis_players; v_name text:=coalesce(nullif(trim(p_name),''),'Wanderer');
begin
  if length(v_name)>18 then v_name:=left(v_name,18); end if;
  insert into public.kelplantis_players(name,color_hue,hp,max_hp,atk)
  values(v_name,coalesce(p_color_hue,140),100,100,22) returning * into v_row;
  insert into public.kelplantis_events(player_token,event_type,payload)
  values(v_row.player_token,'player_created',jsonb_build_object('name',v_row.name));
  return v_row;
end;
$function$;

create or replace function public.kelplantis_attack(p_token uuid)
returns public.kelplantis_players
language plpgsql security definer set search_path=public
as $function$
declare
 r public.kelplantis_players; e jsonb; d jsonb; i int; pd int; ed int; neh int; nph int; nx int; nl int;
 lv boolean:=false; inv jsonb; fp jsonb; qs jsonb; loot jsonb; roll bigint; qr int; firstclear boolean:=false;
 lt jsonb:='[{"key":"kelp_blade","name":"Kelp Blade","slot":"weapon","color":"#7fd39a"},{"key":"moss_cloak","name":"Moss Cloak","slot":"armor","color":"#4c9a6a"},{"key":"sprout_crown","name":"Sprout Crown","slot":"trinket","color":"#d9b35a"}]'::jsonb;
begin
 select * into r from public.kelplantis_players where player_token=p_token for update;
 if not found then raise exception 'unknown player_token'; end if;
 e:=r.current_encounter; if e is null then raise exception 'no active encounter'; end if;
 roll:=('x'||substr(md5(coalesce(e->>'enemy_key','')||':'||coalesce(e->>'room_index','0')||':'||coalesce(e->>'enemy_hp','0')||':'||r.atk||':player'),1,8))::bit(32)::bigint;
 pd:=3+mod(abs(roll),greatest(r.atk,1)); neh:=(e->>'enemy_hp')::int-pd;
 insert into public.kelplantis_events(player_token,event_type,payload)
 values(p_token,'damage_dealt',jsonb_build_object('source','player','amount',pd,'target',e->>'enemy_name','deterministic',true));
 if neh<=0 then
   d:=r.dungeon_state; i:=(d->>'room_index')::int; d:=jsonb_set(d,array['rooms',i::text,'cleared'],'true'::jsonb);
   nx:=r.xp; nl:=r.level; inv:=r.inventory; fp:=coalesce(r.floor_progress,'{}'::jsonb); qs:=coalesce(r.quest_state,'{}'::jsonb);
   if e->>'type'='boss' then
     firstclear:=not coalesce((fp->'1'->>'bossDefeated')::boolean,false); nx:=nx+40;
     fp:=jsonb_set(fp,'{1}',coalesce(fp->'1','{}'::jsonb)||jsonb_build_object('bossDefeated',true,'clearedAt',now()),true);
     roll:=('x'||substr(md5('floor1:boss:loot'),1,8))::bit(32)::bigint; loot:=lt->mod(abs(roll),jsonb_array_length(lt))::int;
     loot:=loot||jsonb_build_object('id',(loot->>'key')||'_floor1_boss'); inv:=inv||jsonb_build_array(loot);
     insert into public.kelplantis_events(player_token,event_type,payload) values(p_token,'enemy_defeated',jsonb_build_object('enemy',e->>'enemy_name','boss',true,'deterministic',true));
     insert into public.kelplantis_events(player_token,event_type,payload) values(p_token,'loot_acquired',loot||jsonb_build_object('deterministic',true));
     if qs->>'garden_warden_intro'='accepted' then
       select reward_xp into qr from public.kelplantis_quests where quest_key='garden_warden_intro';
       nx:=nx+coalesce(qr,0); qs:=jsonb_set(qs,'{garden_warden_intro}','"completed"'::jsonb,true);
       insert into public.kelplantis_events(player_token,event_type,payload) values(p_token,'quest_completed',jsonb_build_object('quest_key','garden_warden_intro','reward_xp',coalesce(qr,0)));
     end if;
     while nx>=nl*20 loop nx:=nx-(nl*20); nl:=nl+1; lv:=true; end loop;
     update public.kelplantis_players set scene='TOWN',pos_x=2,pos_y=1,dungeon_state=null,current_encounter=null,xp=nx,level=nl,max_hp=100+(nl-1)*10,atk=22+(nl-1)*2,hp=least(100+(nl-1)*10,r.hp),inventory=inv,floor_progress=fp,quest_state=qs,updated_at=now() where player_token=p_token returning * into r;
     if firstclear then perform public.kelplantis_record_floor1_boss_clear(r.id); perform public.kelplantis_apply_floor1_first_clear(p_token); end if;
   else
     nx:=nx+10; while nx>=nl*20 loop nx:=nx-(nl*20); nl:=nl+1; lv:=true; end loop;
     d:=jsonb_set(d,'{room_index}',to_jsonb(i+1));
     insert into public.kelplantis_events(player_token,event_type,payload) values(p_token,'enemy_defeated',jsonb_build_object('enemy',e->>'enemy_name','boss',false,'deterministic',true));
     update public.kelplantis_players set dungeon_state=d,current_encounter=null,xp=nx,level=nl,max_hp=100+(nl-1)*10,hp=least(100+(nl-1)*10,r.hp+10),atk=22+(nl-1)*2,updated_at=now() where player_token=p_token returning * into r;
   end if;
   if lv then insert into public.kelplantis_events(player_token,event_type,payload) values(p_token,'progression_changed',jsonb_build_object('level',nl)); end if;
   return r;
 end if;
 roll:=('x'||substr(md5(coalesce(e->>'enemy_key','')||':'||coalesce(e->>'room_index','0')||':'||neh::text||':'||coalesce(e->>'enemy_atk','1')||':enemy'),1,8))::bit(32)::bigint;
 ed:=1+mod(abs(roll),greatest((e->>'enemy_atk')::int,1)); nph:=r.hp-ed;
 insert into public.kelplantis_events(player_token,event_type,payload) values(p_token,'damage_dealt',jsonb_build_object('source',e->>'enemy_name','amount',ed,'target','player','deterministic',true));
 if nph<=0 then
   update public.kelplantis_players set hp=greatest(1,floor(r.max_hp*0.5)::int),scene='TOWN',pos_x=2,pos_y=1,dungeon_state=null,current_encounter=null,updated_at=now() where player_token=p_token returning * into r;
   insert into public.kelplantis_events(player_token,event_type,payload) values(p_token,'player_defeated','{}'::jsonb);
 else
   e:=jsonb_set(e,'{enemy_hp}',to_jsonb(neh));
   update public.kelplantis_players set hp=nph,current_encounter=e,updated_at=now() where player_token=p_token returning * into r;
 end if;
 return r;
end;
$function$;
