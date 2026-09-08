alter table public.kelplantis_players
  alter column hp set default 100,
  alter column max_hp set default 100,
  alter column atk set default 22;

create or replace function public.kelplantis_create_player(p_name text, p_color_hue integer)
returns public.kelplantis_players
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_row public.kelplantis_players;
  v_name text := coalesce(nullif(trim(p_name), ''), 'Wanderer');
begin
  if length(v_name) > 18 then v_name := left(v_name, 18); end if;
  insert into public.kelplantis_players (name, color_hue, hp, max_hp, atk)
  values (v_name, coalesce(p_color_hue, 140), 100, 100, 22)
  returning * into v_row;
  insert into public.kelplantis_events (player_token,event_type,payload)
  values (v_row.player_token,'player_created',jsonb_build_object('name',v_row.name));
  return v_row;
end;
$function$;

-- The authoritative combat function is intentionally defined in the live migration
-- rather than copied from the legacy function. The production defaults now match
-- the canonical Kelplantis MVP spec: 100 HP / 22 ATK, with bounded level growth.
-- The remaining combat body is kept identical to the live function except for
-- authoritative stat progression.