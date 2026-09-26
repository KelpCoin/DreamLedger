insert into public.commerce_items
  (item_id, sku, name, kind, rarity, source_silo, game_usable, compatible_games, unlock_condition, metadata)
values
  ('DRMZ-ITM-003', 'DRMZ-ITM-003', 'Founder Cap', 'accessory', 'common', 'dreammeez', true, '["dreammeez-core","kelplantis"]', 'DreamMeez streak reaches 3 days', '{"legacy_cosmetic_id":"free-cap","slot":"hat","schema_version":"dreammeez-item-v1","cross_game":true}'),
  ('DRMZ-ITM-004', 'DRMZ-ITM-004', 'Veteran Jacket', 'accessory', 'common', 'dreammeez', true, '["dreammeez-core","kelplantis"]', 'DreamMeez streak reaches 7 days', '{"legacy_cosmetic_id":"free-jacket","slot":"clothing","schema_version":"dreammeez-item-v1","cross_game":true}'),
  ('DRMZ-ITM-005', 'DRMZ-ITM-005', 'Gold Chain', 'accessory', 'rare', 'dreammeez', true, '["dreammeez-core","kelplantis"]', 'DreamMeez streak reaches 30 days', '{"legacy_cosmetic_id":"free-goldchain","slot":"accessory","schema_version":"dreammeez-item-v1","cross_game":true}')
on conflict (item_id) do update set
  sku = excluded.sku,
  name = excluded.name,
  kind = excluded.kind,
  rarity = excluded.rarity,
  source_silo = excluded.source_silo,
  game_usable = excluded.game_usable,
  compatible_games = excluded.compatible_games,
  unlock_condition = excluded.unlock_condition,
  metadata = excluded.metadata,
  updated_at = now();
