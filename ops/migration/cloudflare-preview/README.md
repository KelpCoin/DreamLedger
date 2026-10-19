# Cloudflare migration preview: partial read-only runtime

Implemented: Pages ASSETS static serving; `GET /healthz` returns `DEGRADED_STATIC_PREVIEW` with `ready=false`; `GET /version` reports Cloudflare commit metadata where available; GET `/api/products` and `/api/offers` project only published entries from the public `catalog.json`. POST to those read routes is rejected.

Toll, commercial, Stripe webhook and unknown API routes still return HTTP 503. No settlement or fulfillment is mocked. This is not production-ready.

From repository root:
```bash
node ops/migration/cloudflare-preview/build-preview.mjs
node --check ops/migration/cloudflare-preview/_worker.js
node --test ops/recovery/provider-recovery-contract.test.mjs
```

Neon DB connectivity/read-write/read-back, dynamic commerce and engine routes, signed webhook/idempotency, data import reconciliation, backup/restore and rollback remain blocked. Keep production domain and payment routing unchanged.
