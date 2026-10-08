-- MTG community marketplace v1: cards, auctions, trades, forum, and purchase intents.
create table if not exists public.mtg_cards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  set_code text not null default '',
  condition text not null default 'Unspecified',
  language text not null default 'English',
  price_nzd numeric(12,2) not null check (price_nzd > 0),
  inventory integer not null default 1 check (inventory >= 0),
  image_url text,
  description text not null default '',
  status text not null default 'published' check (status in ('draft','published','sold','quarantined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists mtg_cards_public_idx on public.mtg_cards(status, created_at desc);
create index if not exists mtg_cards_owner_idx on public.mtg_cards(owner_id, updated_at desc);

create table if not exists public.mtg_auctions (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid references public.mtg_cards(id) on delete set null,
  deck_id uuid references public.mtg_decks(id) on delete set null,
  title text not null,
  description text not null default '',
  start_price_nzd numeric(12,2) not null check (start_price_nzd > 0),
  current_bid_nzd numeric(12,2) not null check (current_bid_nzd >= 0),
  ends_at timestamptz not null,
  status text not null default 'open' check (status in ('draft','open','ended','cancelled')),
  winner_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check ((card_id is not null) or (deck_id is not null))
);
create index if not exists mtg_auctions_open_idx on public.mtg_auctions(status, ends_at);

create table if not exists public.mtg_bids (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.mtg_auctions(id) on delete cascade,
  bidder_id uuid not null references auth.users(id) on delete cascade,
  amount_nzd numeric(12,2) not null check (amount_nzd > 0),
  created_at timestamptz not null default now()
);
create index if not exists mtg_bids_auction_idx on public.mtg_bids(auction_id, amount_nzd desc, created_at desc);

create table if not exists public.mtg_trades (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  offering text not null,
  seeking text not null,
  status text not null default 'open' check (status in ('open','matched','closed')),
  created_at timestamptz not null default now()
);
create index if not exists mtg_trades_open_idx on public.mtg_trades(status, created_at desc);

create table if not exists public.mtg_trade_offers (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.mtg_trades(id) on delete cascade,
  offerer_id uuid not null references auth.users(id) on delete cascade,
  offer_text text not null,
  status text not null default 'pending' check (status in ('pending','accepted','rejected','withdrawn')),
  created_at timestamptz not null default now()
);

create table if not exists public.mtg_forum_threads (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  category text not null default 'General',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.mtg_forum_posts (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.mtg_forum_threads(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists mtg_forum_threads_idx on public.mtg_forum_threads(updated_at desc);
create index if not exists mtg_forum_posts_idx on public.mtg_forum_posts(thread_id, created_at);

create table if not exists public.mtg_purchase_intents (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid references public.mtg_cards(id) on delete set null,
  deck_id uuid references public.mtg_decks(id) on delete set null,
  quantity integer not null default 1 check (quantity > 0),
  amount_nzd numeric(12,2) not null check (amount_nzd > 0),
  status text not null default 'pending' check (status in ('pending','paid','cancelled','fulfilled')),
  created_at timestamptz not null default now(),
  check ((card_id is not null) or (deck_id is not null))
);

alter table public.mtg_cards enable row level security;
alter table public.mtg_auctions enable row level security;
alter table public.mtg_bids enable row level security;
alter table public.mtg_trades enable row level security;
alter table public.mtg_trade_offers enable row level security;
alter table public.mtg_forum_threads enable row level security;
alter table public.mtg_forum_posts enable row level security;
alter table public.mtg_purchase_intents enable row level security;

drop policy if exists "mtg cards public read" on public.mtg_cards;
create policy "mtg cards public read" on public.mtg_cards for select to anon, authenticated using (status='published' and inventory>0 or (select auth.uid())=owner_id);
drop policy if exists "mtg cards owner write" on public.mtg_cards;
create policy "mtg cards owner write" on public.mtg_cards for all to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);

drop policy if exists "mtg auctions public read" on public.mtg_auctions;
create policy "mtg auctions public read" on public.mtg_auctions for select to anon, authenticated using (status='open' or (select auth.uid())=seller_id);
drop policy if exists "mtg auctions seller write" on public.mtg_auctions;
create policy "mtg auctions seller write" on public.mtg_auctions for all to authenticated using ((select auth.uid())=seller_id) with check ((select auth.uid())=seller_id);

drop policy if exists "mtg bids public read" on public.mtg_bids;
create policy "mtg bids public read" on public.mtg_bids for select to anon, authenticated using (true);
drop policy if exists "mtg bids bidder insert" on public.mtg_bids;
create policy "mtg bids bidder insert" on public.mtg_bids for insert to authenticated with check ((select auth.uid())=bidder_id);

drop policy if exists "mtg trades public read" on public.mtg_trades;
create policy "mtg trades public read" on public.mtg_trades for select to anon, authenticated using (status='open' or (select auth.uid())=owner_id);
drop policy if exists "mtg trades owner write" on public.mtg_trades;
create policy "mtg trades owner write" on public.mtg_trades for all to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);

drop policy if exists "mtg trade offers read" on public.mtg_trade_offers;
create policy "mtg trade offers read" on public.mtg_trade_offers for select to authenticated using ((select auth.uid())=offerer_id or exists (select 1 from public.mtg_trades t where t.id=trade_id and t.owner_id=(select auth.uid())));
drop policy if exists "mtg trade offers insert" on public.mtg_trade_offers;
create policy "mtg trade offers insert" on public.mtg_trade_offers for insert to authenticated with check ((select auth.uid())=offerer_id);

drop policy if exists "mtg threads public read" on public.mtg_forum_threads;
create policy "mtg threads public read" on public.mtg_forum_threads for select to anon, authenticated using (true);
drop policy if exists "mtg threads author write" on public.mtg_forum_threads;
create policy "mtg threads author write" on public.mtg_forum_threads for all to authenticated using ((select auth.uid())=author_id) with check ((select auth.uid())=author_id);
drop policy if exists "mtg posts public read" on public.mtg_forum_posts;
create policy "mtg posts public read" on public.mtg_forum_posts for select to anon, authenticated using (true);
drop policy if exists "mtg posts author write" on public.mtg_forum_posts;
create policy "mtg posts author write" on public.mtg_forum_posts for all to authenticated using ((select auth.uid())=author_id) with check ((select auth.uid())=author_id);

drop policy if exists "mtg purchase own read" on public.mtg_purchase_intents;
create policy "mtg purchase own read" on public.mtg_purchase_intents for select to authenticated using ((select auth.uid())=buyer_id);
drop policy if exists "mtg purchase own insert" on public.mtg_purchase_intents;
create policy "mtg purchase own insert" on public.mtg_purchase_intents for insert to authenticated with check ((select auth.uid())=buyer_id);

grant select on public.mtg_cards, public.mtg_auctions, public.mtg_bids, public.mtg_trades, public.mtg_forum_threads, public.mtg_forum_posts to anon, authenticated;
grant insert, update, delete on public.mtg_cards, public.mtg_auctions, public.mtg_trades, public.mtg_forum_threads, public.mtg_forum_posts to authenticated;
grant insert, select on public.mtg_bids, public.mtg_purchase_intents to authenticated;
grant select on public.mtg_trade_offers to authenticated;
grant insert on public.mtg_trade_offers to authenticated;
