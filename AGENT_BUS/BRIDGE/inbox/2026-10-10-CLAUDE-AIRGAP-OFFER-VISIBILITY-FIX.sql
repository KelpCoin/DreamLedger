-- =============================================================================
-- FIX: hide offers that are publicly visible/featured but have no Stripe
-- product or price attached, so real visitors stop hitting a dead-end buy flow.
--
-- STATUS: AIR-GAPPED / PENDING INTEGRATION
-- This was written while the Supabase MCP tool was unavailable in-session
-- (rejected outright, not a timeout). It has NOT been executed. Nothing in
-- this file should be treated as applied until it has actually been run
-- against the live project and the verification query at the bottom has
-- been checked.
--
-- CONTEXT (verified prior to the tool becoming unavailable):
--   select id, title, slug, lifecycle_status, visibility, stripe_product_id, stripe_price_id
--   from public.offers order by id;
-- showed three offers marked visibility IN ('live','featured') with both
-- stripe_product_id and stripe_price_id null:
--   - MTG Collection Valuation
--   - Draft Strategy Guide
--   - DreamLedger Billboard Small
-- Confirmed valid visibility values in this table: 'public', 'featured', 'hidden'.
-- lifecycle_status values were NOT confirmed (two lookup attempts timed out) --
-- this script deliberately does not touch lifecycle_status, only visibility,
-- to avoid writing an enum value that may not exist.
--
-- WHAT THIS DOES: sets visibility='hidden' ONLY for rows that currently have
-- NO stripe_product_id AND NO stripe_price_id AND are currently 'public' or
-- 'featured'. It never touches a row that already has real Stripe IDs, and
-- it is safe to re-run (idempotent -- a second run matches zero rows).
--
-- WHAT THIS DOES NOT DO: it does not create Stripe products/prices. That
-- requires actual Stripe write access, which this session does not have.
-- Once a real product+price exists for one of these offers, the correct
-- next step is to set stripe_product_id/stripe_price_id AND restore
-- visibility in the same statement -- not to flip visibility back alone.
-- =============================================================================

begin;

-- Capture exactly what will change, before changing it.
create temporary table _offer_visibility_fix_before as
select id, title, slug, visibility, stripe_product_id, stripe_price_id
from public.offers
where stripe_product_id is null
  and stripe_price_id is null
  and visibility in ('public','featured');

update public.offers
set visibility = 'hidden'
where stripe_product_id is null
  and stripe_price_id is null
  and visibility in ('public','featured');

-- Verification: row-by-row before/after.
select b.id, b.title, b.slug, b.visibility as visibility_before, o.visibility as visibility_after
from _offer_visibility_fix_before b
join public.offers o on o.id = b.id
order by b.id;

commit;

-- After running, also check nothing else with real Stripe IDs was touched
-- by mistake:
-- select count(*) as should_be_zero from public.offers
-- where visibility = 'hidden' and stripe_product_id is not null;
