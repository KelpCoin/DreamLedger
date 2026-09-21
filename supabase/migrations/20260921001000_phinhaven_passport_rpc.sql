create or replace function public.kelplantis_get_passport_for_token(p_token uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_player public.phinhaven_players%rowtype; v_titles jsonb; v_guild jsonb; v_events jsonb;
begin
 select * into v_player from public.phinhaven_players where player_token=p_token limit 1;
 if v_player.id is null then raise exception 'player not found'; end if;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.defining_skill_level desc nulls last, t.updated_at desc),'[]'::jsonb) into v_titles from public.phinhaven_player_titles t where t.player_id=v_player.id;
 select coalesce((select jsonb_build_object('id',g.id,'name',g.name,'tag',g.tag,'role',m.role_key,'loyalty_score',m.loyalty_score,'contribution_score',m.contribution_score) from public.phinhaven_guild_memberships m join public.phinhaven_guilds g on g.id=m.guild_id where m.player_id=v_player.id and m.status='active' and m.left_at is null order by m.joined_at desc limit 1),'null'::jsonb) into v_guild;
 select coalesce(jsonb_agg(e order by e.occurred_at desc),'[]'::jsonb) into v_events from (select id,event_type,payload,occurred_at from public.phinhaven_events where player_token=p_token order by occurred_at desc limit 20) e;
 return jsonb_build_object('player_id',v_player.id,'name',v_player.name,'level',v_player.level,'xp',v_player.xp,'scene',v_player.scene,'position',jsonb_build_object('x',v_player.pos_x,'y',v_player.pos_y),'guild',v_guild,'titles',v_titles,'recent_evidence',v_events,'passport_rule','Evidence-derived; raw events remain authoritative');
end $$;
