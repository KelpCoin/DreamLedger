-- Dream Ledger 3000: secure persistent Ledger tables.
-- Applied to Supabase project wbwgroygjeyukkspnqiy on 2026-09-03.
-- Existing schema uses owner_account_id (text) for the native auth runtime.
-- user_id is also accepted when populated with a Supabase Auth UUID.
-- dream_ledger_items uses published boolean, not a status column.
-- dream_ledger_streaks stores one streak per ledger, so ownership is inherited from the Ledger.

begin;

alter table public.dream_ledgers enable row level security;
alter table public.dream_ledger_items enable row level security;
alter table public.dream_ledger_follows enable row level security;
alter table public.dream_ledger_streaks enable row level security;
alter table public.dream_ledger_events enable row level security;

drop policy if exists dream_ledgers_public_read on public.dream_ledgers;
create policy dream_ledgers_public_read on public.dream_ledgers for select to anon, authenticated using (status = 'active');

drop policy if exists dream_ledgers_owner_read on public.dream_ledgers;
create policy dream_ledgers_owner_read on public.dream_ledgers for select to authenticated using (owner_account_id = auth.uid()::text or user_id = auth.uid());

drop policy if exists dream_ledgers_owner_insert on public.dream_ledgers;
create policy dream_ledgers_owner_insert on public.dream_ledgers for insert to authenticated with check (owner_account_id = auth.uid()::text or user_id = auth.uid());

drop policy if exists dream_ledgers_owner_update on public.dream_ledgers;
create policy dream_ledgers_owner_update on public.dream_ledgers for update to authenticated using (owner_account_id = auth.uid()::text or user_id = auth.uid()) with check (owner_account_id = auth.uid()::text or user_id = auth.uid());

drop policy if exists dream_ledgers_owner_delete on public.dream_ledgers;
create policy dream_ledgers_owner_delete on public.dream_ledgers for delete to authenticated using (owner_account_id = auth.uid()::text or user_id = auth.uid());

drop policy if exists dream_ledger_items_public_read on public.dream_ledger_items;
create policy dream_ledger_items_public_read on public.dream_ledger_items for select to anon, authenticated using (published = true and exists (select 1 from public.dream_ledgers l where l.id = dream_ledger_items.ledger_id and l.status = 'active'));

drop policy if exists dream_ledger_items_owner_read on public.dream_ledger_items;
create policy dream_ledger_items_owner_read on public.dream_ledger_items for select to authenticated using (exists (select 1 from public.dream_ledgers l where l.id = dream_ledger_items.ledger_id and (l.owner_account_id = auth.uid()::text or l.user_id = auth.uid())));

drop policy if exists dream_ledger_items_owner_insert on public.dream_ledger_items;
create policy dream_ledger_items_owner_insert on public.dream_ledger_items for insert to authenticated with check (exists (select 1 from public.dream_ledgers l where l.id = dream_ledger_items.ledger_id and (l.owner_account_id = auth.uid()::text or l.user_id = auth.uid())));

drop policy if exists dream_ledger_items_owner_update on public.dream_ledger_items;
create policy dream_ledger_items_owner_update on public.dream_ledger_items for update to authenticated using (exists (select 1 from public.dream_ledgers l where l.id = dream_ledger_items.ledger_id and (l.owner_account_id = auth.uid()::text or l.user_id = auth.uid()))) with check (exists (select 1 from public.dream_ledgers l where l.id = dream_ledger_items.ledger_id and (l.owner_account_id = auth.uid()::text or l.user_id = auth.uid())));

drop policy if exists dream_ledger_items_owner_delete on public.dream_ledger_items;
create policy dream_ledger_items_owner_delete on public.dream_ledger_items for delete to authenticated using (exists (select 1 from public.dream_ledgers l where l.id = dream_ledger_items.ledger_id and (l.owner_account_id = auth.uid()::text or l.user_id = auth.uid())));

drop policy if exists dream_ledger_follows_public_read on public.dream_ledger_follows;
create policy dream_ledger_follows_public_read on public.dream_ledger_follows for select to anon, authenticated using (true);

drop policy if exists dream_ledger_follows_owner_insert on public.dream_ledger_follows;
create policy dream_ledger_follows_owner_insert on public.dream_ledger_follows for insert to authenticated with check (follower_user_id = auth.uid());

drop policy if exists dream_ledger_follows_owner_delete on public.dream_ledger_follows;
create policy dream_ledger_follows_owner_delete on public.dream_ledger_follows for delete to authenticated using (follower_user_id = auth.uid());

drop policy if exists dream_ledger_streaks_public_read on public.dream_ledger_streaks;
create policy dream_ledger_streaks_public_read on public.dream_ledger_streaks for select to anon, authenticated using (true);

drop policy if exists dream_ledger_streaks_owner_insert on public.dream_ledger_streaks;
create policy dream_ledger_streaks_owner_insert on public.dream_ledger_streaks for insert to authenticated with check (exists (select 1 from public.dream_ledgers l where l.id = dream_ledger_streaks.ledger_id and (l.owner_account_id = auth.uid()::text or l.user_id = auth.uid())));

drop policy if exists dream_ledger_streaks_owner_update on public.dream_ledger_streaks;
create policy dream_ledger_streaks_owner_update on public.dream_ledger_streaks for update to authenticated using (exists (select 1 from public.dream_ledgers l where l.id = dream_ledger_streaks.ledger_id and (l.owner_account_id = auth.uid()::text or l.user_id = auth.uid()))) with check (exists (select 1 from public.dream_ledgers l where l.id = dream_ledger_streaks.ledger_id and (l.owner_account_id = auth.uid()::text or l.user_id = auth.uid())));

drop policy if exists dream_ledger_events_public_read on public.dream_ledger_events;
create policy dream_ledger_events_public_read on public.dream_ledger_events for select to anon, authenticated using (true);

drop policy if exists dream_ledger_events_owner_insert on public.dream_ledger_events;
create policy dream_ledger_events_owner_insert on public.dream_ledger_events for insert to authenticated with check (exists (select 1 from public.dream_ledgers l where l.id = dream_ledger_events.ledger_id and (l.owner_account_id = auth.uid()::text or l.user_id = auth.uid())));

commit;
