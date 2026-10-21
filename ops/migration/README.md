# Render + Supabase replacement: migration gate

This folder is the controlled migration entry point. It is deliberately not an auto-import or auto-cutover script.

## Current blockers

- Render's public static service is still active, while several Render web services are suspended for billing.
- Supabase control plane reports DreamLedger wbwgroygjeyukkspnqiy as active, but the connected database endpoint refused TCP connections during audit. No database export has been proven.
- The connected Neon account currently returns no projects. No target database exists in that account yet.
- Cloudflare Pages credentials, account ID, and a verified target Pages project are not configured in the deployment workflow.
- The Commander Diagnostic Stripe link could not be read or deactivated through the current Stripe connection. Its public URL is removed from catalogue surfaces, but remote deactivation remains unconfirmed.

## Phase 1: private source backup

Install PostgreSQL client tools (psql and pg_dump). Retrieve the source connection string from the Supabase dashboard. Prefer the Session Pooler connection string when the workstation/network cannot reach the direct endpoint. Store it as SUPABASE_DB_URL in the current PowerShell process; do not paste it into chat or commit it. Run the export script in this directory and keep its output private and off GitHub.

The export script will only read the source, produce a private full backup plus an inventory, and create SHA-256 hashes. It must not import, delete, pause, or modify Supabase. A failed connection must fail the process.

## Phase 2: dependency mapping

Review the inventory for custom tables/functions/triggers, RLS policies, views, foreign keys into Supabase-managed schemas, extensions, and routines. Supabase Auth and Storage have service-specific assumptions. Do not blindly restore their auth and storage schemas into Neon and assume equivalent services will operate.

Explicit replacements are required for:

- Postgres tables, views, functions, triggers, constraints, indexes and application authorization/RLS.
- Auth identity mapping, provider connections, password-reset/login flow, user metadata and foreign keys.
- Storage object bytes, bucket policies, public/private access, signed URLs, and metadata. Cloudflare R2 is the candidate object store.
- Supabase Edge Functions, scheduled tasks, webhooks and any Realtime channels. Cloudflare Workers is the candidate runtime; Realtime requires its own tested replacement.
- Environment variables, secrets, and external callbacks. Never migrate secrets through source files or build artifacts.

## Phase 3: static Pages candidate

scripts/build-cloudflare-pages.mjs builds a static artifact from the canonical compiled website and explicitly includes /mtg/index.html, /data/mtg-catalog.json, and /catalog.json. The Verify Cloudflare Pages candidate workflow builds/uploads an artifact on a pull request and makes no public deployment. The separate manual deploy workflow requires an explicit workflow-dispatch confirmation plus CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, and CLOUDFLARE_PAGES_PROJECT_NAME. The target must be a Cloudflare Pages Direct Upload project for Wrangler deployment.

Cloudflare Pages replaces only the static web origin. It does not replace the DreamLedger engine or Supabase data services by itself.

## Phase 4: cutover gates

Do not change DNS or retire Render/Supabase until evidence proves all applicable gates:

1. Cloudflare production routes /, /mtg/, /catalog.json, and /data/mtg-catalog.json return HTTP 200; JSON parses; catalogue IDs reconcile; unavailable feeds show an honest empty state.
2. All API/runtime endpoints currently hosted on Render are replaced and pass parity, authentication, abuse-limit, webhook and fulfillment tests.
3. A full source backup is hashed; source/destination row counts reconcile; schema objects, constraints, triggers, grants, extensions and authorization are tested.
4. Auth identities and application references reconcile; login/password-reset/provider flows work. Storage object counts and hashes reconcile. Scheduled functions, Edge Functions and Realtime equivalents are tested where used.
5. Held-offer payment links are confirmed inactive at Stripe. Checkout, settlement, attribution, fulfillment and delivery-proof paths pass an independently observed test.
6. DNS cutover is monitored and rollback is available. Only after stable replacement health and explicit approval should Render services be deleted and the Supabase project paused/decommissioned.

Until those gates pass, the truthful state is MIGRATION_IN_PROGRESS, not “Render/Supabase replaced.” Builds, checkout starts, heartbeats and health routes are not revenue.
