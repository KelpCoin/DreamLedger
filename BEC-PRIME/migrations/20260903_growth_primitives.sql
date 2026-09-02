-- Dream Ledger 3000 growth primitives and native-auth bridge.
-- Applied to Supabase project wbwgroygjeyukkspnqiy on 2026-09-03.

begin;

alter table public.dream_ledger_follows add column if not exists follower_account_id text;
create unique index if not exists dream_ledger_follows_account_unique on public.dream_ledger_follows (ledger_id, follower_account_id) where follower_account_id is not null;

drop policy if exists dream_ledger_follows_account_insert on public.dream_ledger_follows;
create policy dream_ledger_follows_account_insert on public.dream_ledger_follows for insert to authenticated with check (follower_account_id = auth.uid()::text);

drop policy if exists dream_ledger_follows_account_delete on public.dream_ledger_follows;
create policy dream_ledger_follows_account_delete on public.dream_ledger_follows for delete to authenticated using (follower_account_id = auth.uid()::text);

create table if not exists public.dynamic_links (
  slug text primary key,
  target_url text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_dynamic_links (
  user_id uuid not null,
  slug text not null,
  target_url text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, slug)
);

create table if not exists public.dream_ledger_saves (
  item_id uuid not null references public.dream_ledger_items(id) on delete cascade,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (item_id, user_id)
);

create table if not exists public.dream_ledger_referrals (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references public.dream_ledgers(id) on delete cascade,
  referred_user_id uuid,
  source text,
  created_at timestamptz not null default now()
);

alter table public.dynamic_links enable row level security;
alter table public.user_dynamic_links enable row level security;
alter table public.dream_ledger_saves enable row level security;
alter table public.dream_ledger_referrals enable row level security;

drop policy if exists dynamic_links_public_read on public.dynamic_links;
create policy dynamic_links_public_read on public.dynamic_links for select to anon, authenticated using (true);

drop policy if exists user_dynamic_links_owner_all on public.user_dynamic_links;
create policy user_dynamic_links_owner_all on public.user_dynamic_links for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists dream_ledger_saves_owner_all on public.dream_ledger_saves;
create policy dream_ledger_saves_owner_all on public.dream_ledger_saves for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists dream_ledger_referrals_public_read on public.dream_ledger_referrals;
create policy dream_ledger_referrals_public_read on public.dream_ledger_referrals for select to authenticated using (exists (select 1 from public.dream_ledgers l where l.id = dream_ledger_referrals.ledger_id and (l.owner_account_id = auth.uid()::text or l.user_id = auth.uid())));

insert into public.dynamic_links(slug, target_url) values ('go', '/discover') on conflict (slug) do nothing;

commit;
