# Cloudflare migration preview: partial read-only runtime

Implemented: Pages ASSETS static serving; GET /healthz returns DEGRADED_STATIC_PREVIEW with ready=false; GET /version reports Cloudflare commit metadata where available; GET /api/products and /api/offers project published entries only from public/catalog.json. POST to those read-only routes is rejected.

The migration branch preview workflow builds and deploys only to the dedicated provider-migration-preview Pages branch. It never changes production DNS. It runs on relevant pushes to the migration branch (and can still be manually dispatched) and requires the existing owner-configured Cloudflare GitHub secrets. Missing secrets must produce an explicit BLOCKED result before any deploy command.

## Static-route acceptance

The bundle requires public/404.html. This file disables Pages' default root-SPA fallback behavior for unmatched paths. The deployed smoke probe checks:
- root, /mtg/, Truth Oracle, the MTG silo manifest and the MTG catalogue;
- every catalogue item with status published has a safe detail_url returning 200 HTML with a matching product identity;
- every published MTG item has a syntactically safe claim_url, and its detail page exposes a claim control; claim-by-message remains a message action, not online checkout;
- a unique nonexistent .html path returns an actual HTTP 404 and the dedicated not-found marker, rather than returning the homepage with status 200;
- /version exactly matches the deployed Git commit SHA;
- unported payment, toll and webhook APIs remain 503 and explicitly not production-ready.

Run the preview route smoke probe after deployment:
node ops/migration/cloudflare-preview/smoke-preview.mjs

## Deliberately not production-ready

Toll, commercial, Stripe webhook and unknown API routes still return HTTP 503. No settlement or fulfillment is mocked. This is not production-ready.

Neon DB connectivity/read-write/read-back, dynamic commerce and engine routes, signed webhook/idempotency, data import reconciliation, backup/restore and rollback remain blocked. The preview workflow does not change production DNS, payment URLs or provider configuration. The build/preview route proof is not migration acceptance.

Before any database dump scope is selected, inventory all schemas and custom dependencies, including RLS policies and custom triggers/functions attached to Supabase auth, storage and realtime objects. Do not copy Supabase-managed platform internals blindly into Neon.

Webhook correctness is also a separate gate: transactionally claim unique Stripe events and update database-side ledger state, then use a durable idempotent outbox for external fulfillment. Never delete an event claim after an uncertain side effect; reconcile or retry using the same idempotency key.
