create table if not exists public.mtg_decks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  commander text not null,
  description text not null default '',
  condition text not null default 'Unspecified',
  price_nzd numeric(12,2) not null check (price_nzd > 0),
  inventory integer not null default 1 check (inventory >= 0),
  decklist_text text not null,
  card_count integer not null default 0 check (card_count >= 0),
  unique_card_count integer not null default 0 check (unique_card_count >= 0),
  image_url text,
  status text not null default 'draft' check (status in ('draft','published','sold','quarantined')),
  source text not null default 'mtg_deck_upload',
  social_copy jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mtg_decks_public_idx
  on public.mtg_decks(status, published_at desc);

create index if not exists mtg_decks_owner_idx
  on public.mtg_decks(owner_id, updated_at desc);

alter table public.mtg_decks enable row level security;

drop policy if exists "mtg deck owner read" on public.mtg_decks;
create policy "mtg deck owner read"
  on public.mtg_decks for select
  to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "mtg deck owner insert" on public.mtg_decks;
create policy "mtg deck owner insert"
  on public.mtg_decks for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

drop policy if exists "mtg deck owner update" on public.mtg_decks;
create policy "mtg deck owner update"
  on public.mtg_decks for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists "mtg deck owner delete" on public.mtg_decks;
create policy "mtg deck owner delete"
  on public.mtg_decks for delete
  to authenticated
  using ((select auth.uid()) = owner_id);

grant select, insert, update, delete on public.mtg_decks to authenticated;
