-- Run only after the corresponding hardening migrations have been applied
-- in an approved non-production or controlled database window.
do $$
begin
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'commerce_item_ownership' and c.relrowsecurity
  ) then raise exception 'FAIL: RLS is not enabled on commerce_item_ownership'; end if;

  if exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'commerce_item_ownership' and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  ) then raise exception 'FAIL: ownership mutation policy remains'; end if;

  if has_table_privilege('anon', 'public.commerce_item_ownership', 'INSERT')
     or has_table_privilege('authenticated', 'public.commerce_item_ownership', 'INSERT')
     or has_table_privilege('anon', 'public.commerce_item_ownership', 'UPDATE')
     or has_table_privilege('authenticated', 'public.commerce_item_ownership', 'UPDATE')
     or has_table_privilege('anon', 'public.commerce_item_ownership', 'DELETE')
     or has_table_privilege('authenticated', 'public.commerce_item_ownership', 'DELETE') then
    raise exception 'FAIL: browser role retains ownership write privilege';
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'commerce_item_ownership'
      and policyname = 'commerce_item_ownership_self_read' and cmd = 'SELECT'
  ) then raise exception 'FAIL: ownership self-read policy missing'; end if;

  if has_column_privilege('authenticated', 'public.mtg_cards', 'status', 'INSERT')
     or has_column_privilege('authenticated', 'public.mtg_cards', 'status', 'UPDATE') then
    raise exception 'FAIL: authenticated user can set MTG card publication status';
  end if;

  if has_column_privilege('authenticated', 'public.mtg_collection_inventory', 'status', 'INSERT')
     or has_column_privilege('authenticated', 'public.mtg_collection_inventory', 'status', 'UPDATE') then
    raise exception 'FAIL: authenticated user can set MTG inventory publication status';
  end if;

  if has_table_privilege('authenticated', 'public.mtg_decks', 'INSERT')
     or has_table_privilege('authenticated', 'public.mtg_decks', 'UPDATE')
     or has_table_privilege('authenticated', 'public.mtg_decks', 'DELETE') then
    raise exception 'FAIL: direct MTG deck writes bypass the authenticated review API';
  end if;

  if has_table_privilege('authenticated', 'public.mtg_auctions', 'INSERT')
     or has_table_privilege('authenticated', 'public.mtg_auctions', 'UPDATE')
     or has_table_privilege('authenticated', 'public.mtg_auctions', 'DELETE') then
    raise exception 'FAIL: auction state remains client-mutable';
  end if;

  if has_table_privilege('authenticated', 'public.mtg_bids', 'INSERT')
     or has_table_privilege('authenticated', 'public.mtg_bids', 'UPDATE')
     or has_table_privilege('authenticated', 'public.mtg_bids', 'DELETE') then
    raise exception 'FAIL: bids remain client-mutable without atomic validation';
  end if;

  if has_table_privilege('authenticated', 'public.mtg_purchase_intents', 'INSERT')
     or has_table_privilege('authenticated', 'public.mtg_purchase_intents', 'UPDATE')
     or has_table_privilege('authenticated', 'public.mtg_purchase_intents', 'DELETE') then
    raise exception 'FAIL: client can forge paid/fulfilled purchase-intent state';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'mtg_cards'
      and column_name = 'status' and column_default like '%draft%'
  ) then raise exception 'FAIL: new MTG cards do not default to draft'; end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'mtg_auctions'
      and column_name = 'status' and column_default like '%draft%'
  ) then raise exception 'FAIL: new MTG auctions do not default to draft'; end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'mtg_collection_inventory'
      and column_name = 'status' and column_default like '%draft%'
  ) then raise exception 'FAIL: new inventory imports do not default to draft'; end if;
end
$$;

select 'PASS: server-issued ownership, publication, auction, bid and purchase-intent state is protected.'
  as result;
