-- Canonicalize Kelplantis storage identifiers to Phin Haven.
-- Runtime data is preserved by PostgreSQL ALTER TABLE RENAME.
do $$
declare n text;
begin
  foreach n in array array['asset_rules','canon','client_builds','content_bank','cosmetic_ownership','cosmetics','differentiators','domino_canon','events','floor_control','floor_gates','floor_progression','floor_resources','floor_specs','game_systems','guild_memberships','guild_relations','guilds','loot_awards','mvp_milestones','parcels','party_members','party_runs','player_inventory','player_titles','players','quests','resource_nodes','soul_anchors','soul_events','world_state']
  loop
    execute format('alter table if exists public.kelplantis_%I rename to phinhaven_%I',n,n);
  end loop;
end $$;
