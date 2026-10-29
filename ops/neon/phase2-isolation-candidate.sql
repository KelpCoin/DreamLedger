-- BECK / NEON PHASE 2 candidate, NOT APPROVED TO APPLY.
-- Grounded against dreamledger-migration-staging 2026-10-29.
-- This migration intentionally does not grant traffic access or rewrite existing
-- policies: no verified application auth boundary, no disposable test branch.
-- Review on an isolated Neon branch and run adversarial runtime-role tests.
BEGIN;
-- A NOLOGIN marker role avoids activating a new public credential by mistake.
-- The application role must eventually be separately provisioned and authenticated
-- by trusted server code; merely setting app.principal_id is NOT authentication.
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='beck_runtime_candidate') THEN
   CREATE ROLE beck_runtime_candidate NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS;
 END IF;
END $$;
-- Prevent table-owner bypass on the tenant-scoped marketplace tables.
ALTER TABLE marketplace.listings FORCE ROW LEVEL SECURITY;
ALTER TABLE marketplace.orders FORCE ROW LEVEL SECURITY;
ALTER TABLE marketplace.memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE marketplace.organizations FORCE ROW LEVEL SECURITY;
ALTER TABLE marketplace.organization_silos FORCE ROW LEVEL SECURITY;
-- Reservations have listing_id, NOT tenant_id / organization_id.
-- Enabling without an allow policy intentionally denies non-bypass access.
-- A verified tenant-scoped policy and runtime privileges are REQUIRED before use.
ALTER TABLE marketplace.stock_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace.stock_reservations FORCE ROW LEVEL SECURITY;
COMMIT;
-- HOLD: no GRANT, no credential rotation, no production promotion.
-- Critical: dreamledger_app currently BYPASSRLS and owns tables. FORCE RLS
-- does NOT override BYPASSRLS, so this alone cannot pass isolation.
-- Critical: reserve_stock_v2 is SECURITY INVOKER and will need explicit
-- policy/grant integration before caller role changes.
