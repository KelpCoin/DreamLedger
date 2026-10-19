-- Fail closed on user-controlled publication, bids, purchase states and auctions.
-- Trusted service-role APIs are not revoked by these grants; they must still enforce
-- authorization, inventory, settled payment, idempotency and delivery proof.
begin;

-- Public listings may be created/edited by their owner, but publication status is
-- server-controlled. Existing rows are deliberately not rewritten by this migration.
alter table public.mtg_cards alter column status set default 'draft';
revoke insert, update, delete on table public.mtg_cards from public, anon, authenticated;
grant insert (owner_id, name, set_code, condition, language, price_nzd, inventory, image_url, description)
  on table public.mtg_cards to authenticated;
grant update (name, set_code, condition, language, price_nzd, inventory, image_url, description)
  on table public.mtg_cards to authenticated;

-- Deck submissions go through mtg-deck-catalog, which authenticates the seller.
-- Direct table writes would bypass the API's moderation hold.
drop policy if exists "mtg deck owner insert" on public.mtg_decks;
drop policy if exists "mtg deck owner update" on public.mtg_decks;
drop policy if exists "mtg deck owner delete" on public.mtg_decks;
revoke insert, update, delete on table public.mtg_decks from public, anon, authenticated;

-- Auction state, current bid and winner are server-controlled. No atomic bid/auction
-- mutation RPC is proven in the inspected source, so direct user mutations stay held.
alter table public.mtg_auctions alter column status set default 'draft';
drop policy if exists "mtg auctions seller write" on public.mtg_auctions;
revoke insert, update, delete on table public.mtg_auctions from public, anon, authenticated;

-- A bidder cannot write a bid row directly until an atomic auction validation RPC exists.
drop policy if exists "mtg bids bidder insert" on public.mtg_bids;
revoke insert, update, delete on table public.mtg_bids from public, anon, authenticated;

-- Clients must not set purchase-intent amount or status (including paid/fulfilled).
-- Re-enable creation only through a trusted function that derives price and verifies
-- the target listing, inventory, checkout, settlement and fulfillment states.
drop policy if exists "mtg purchase own insert" on public.mtg_purchase_intents;
revoke insert, update, delete on table public.mtg_purchase_intents from public, anon, authenticated;

-- Imported collection records remain user-owned; publication status is not a client
-- field. Import code must omit status so new rows use the draft default.
alter table public.mtg_collection_inventory alter column status set default 'draft';
revoke insert, update, delete on table public.mtg_collection_inventory from public, anon, authenticated;
grant insert (owner_id, card_name, set_code, collector_number, quantity, condition, language, finish, price_nzd, source, metadata, fingerprint)
  on table public.mtg_collection_inventory to authenticated;
grant update (owner_id, card_name, set_code, collector_number, quantity, condition, language, finish, price_nzd, source, metadata, fingerprint)
  on table public.mtg_collection_inventory to authenticated;

commit;
