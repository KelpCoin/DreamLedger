create table if not exists public.mtg_collection_inventory (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 card_name text not null,
 set_code text,
 collector_number text,
 quantity integer not null default 1 check (quantity > 0),
 condition text,
 language text default 'en',
 finish text default 'nonfoil',
 price_nzd numeric,
 status text not null default 'draft' check (status in ('draft','priced','published','sold','quarantined')),
 source text not null default 'collection_import',
 metadata jsonb not null default '{}'::jsonb,
 fingerprint text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create unique index if not exists mtg_collection_inventory_owner_fingerprint_uidx on public.mtg_collection_inventory(owner_id,fingerprint);
create index if not exists mtg_collection_inventory_owner_idx on public.mtg_collection_inventory(owner_id);
create index if not exists mtg_collection_inventory_status_idx on public.mtg_collection_inventory(status);
alter table public.mtg_collection_inventory enable row level security;
drop policy if exists "owner read mtg inventory" on public.mtg_collection_inventory;
create policy "owner read mtg inventory" on public.mtg_collection_inventory for select to authenticated using (auth.uid()=owner_id);
drop policy if exists "owner write mtg inventory" on public.mtg_collection_inventory;
create policy "owner write mtg inventory" on public.mtg_collection_inventory for all to authenticated using (auth.uid()=owner_id) with check (auth.uid()=owner_id);
grant select,insert,update,delete on public.mtg_collection_inventory to authenticated;