# DreamLedger marketplace pilot

Status: implementation branch, not production commerce. No Stripe checkout, seller payouts, escrow, auction settlement or automatic publication.

Requires Node.js 22.13+ with `node:sqlite`. Use a durable local volume. Never put database files into source control.

Run: `MARKETPLACE_ADMIN_TOKEN=<private-value> MARKETPLACE_DATA_DIR=<durable-path> node marketplace-core/server.cjs`

Test: `node --test marketplace-core/server.test.cjs`

API: GET `/`, `/api/health`, `/api/listings`, `/api/markets`; POST `/api/register`, `/api/listings`, `/api/listings/:id/bid`, `/api/billboard`; PUT `/api/avatar`. Bearer token returned at registration authenticates API actions.

Admin requests use `x-marketplace-admin-token` to GET `/api/admin/queue` and POST `/api/admin/review` with `table`, `id`, and `action` (`approve` or `reject`).

Public display shows approved listings only. Billboard entries require approval and never exceed 100 units per market. Audit records are kept in SQLite. This pilot is intended for isolated testing; production must add hardened authentication, account recovery, rate limiting, seller verification, tax/shipping, Stripe authorization, fulfillment, disputes, search, moderation tooling, and auction settlement.

Privacy: isolate this database from adult or MTG-specific silo databases. No cross-silo promotion without approval.