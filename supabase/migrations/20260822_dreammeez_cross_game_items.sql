create table if not exists public.commerce_items (
  item_id text primary key,
  sku text not null unique,
  name text not null,
  kind text not null,
  rarity text,
  source_silo text not null,
  image_url text,
  unlock_price_nzd numeric(12,2),
  unlock_condition text,
  game_usable boolean not null default false,
  compatible_games jsonb not null default '[]'::jsonb,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commerce_item_ownership (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null references public.commerce_items(item_id) on delete cascade,
  acquired_at timestamptz not null default now(),
  source text not null default 'purchase',
  primary key (user_id, item_id)
);

create table if not exists public.commerce_referrals (
  code text primary key,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  referred_user_id uuid references auth.users(id) on delete set null,
  rewarded_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.commerce_items enable row level security;
alter table public.commerce_item_ownership enable row level security;
alter table public.commerce_referrals enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='commerce_items' and policyname='commerce_items_public_read') then
    create policy commerce_items_public_read on public.commerce_items for select to public using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='commerce_item_ownership' and policyname='commerce_item_ownership_self_read') then
    create policy commerce_item_ownership_self_read on public.commerce_item_ownership for select to authenticated using ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='commerce_item_ownership' and policyname='commerce_item_ownership_self_insert') then
    create policy commerce_item_ownership_self_insert on public.commerce_item_ownership for insert to authenticated with check ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='commerce_referrals' and policyname='commerce_referrals_self_read') then
    create policy commerce_referrals_self_read on public.commerce_referrals for select to authenticated using ((select auth.uid()) = owner_user_id or (select auth.uid()) = referred_user_id);
  end if;
end $$;

insert into public.commerce_items
  (item_id, sku, name, kind, rarity, source_silo, game_usable, compatible_games, metadata)
values
  ('DRMZ-AVT-001', 'DRMZ-AVT-001', 'DreamShell', 'avatar', 'common', 'dreammeez', true, '["dreammeez-core","kelplantis"]', '{"schema_version":"dreammeez-item-v1","cross_game":true}'),
  ('DRMZ-ITM-001', 'DRMZ-ITM-001', 'DreamShell Starter Jacket', 'accessory', 'common', 'dreammeez', true, '["dreammeez-core","kelplantis"]', '{"schema_version":"dreammeez-item-v1","cross_game":true}'),
  ('DRMZ-ITM-002', 'DRMZ-ITM-002', 'Elohim Bloom', 'accessory', 'rare', 'dreammeez', true, '["dreammeez-core","kelplantis"]', '{"schema_version":"dreammeez-item-v1","cross_game":true}')
on conflict (item_id) do update set
  sku = excluded.sku,
  name = excluded.name,
  kind = excluded.kind,
  rarity = excluded.rarity,
  source_silo = excluded.source_silo,
  game_usable = excluded.game_usable,
  compatible_games = excluded.compatible_games,
  metadata = excluded.metadata,
  updated_at = now();
