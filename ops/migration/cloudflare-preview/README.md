# Cloudflare migration preview scaffold

This folder creates a **non-production preview bundle** from the existing public assets and places the Advanced Mode Worker at the root of the build output.

## Build locally / in CI

From the repository root:

```bash
node ops/migration/cloudflare-preview/build-preview.mjs
node --check ops/migration/cloudflare-preview/_worker.js
node --test ops/recovery/provider-recovery-contract.test.mjs
```

Build output: `ops/migration/cloudflare-preview/dist/`  
Local proof: `ops/migration/cloudflare-preview/build-proof.json`

The builder omits known Node runtime/webhook/preload files, package metadata, hidden directories, tests and internal work notes. Review the generated manifest before any upload. This is not a full privacy audit.

## Important: not production-ready

The Worker serves static assets but deliberately returns HTTP 503 for runtime-dependent routes including health/version, APIs, toll, commercial endpoints and Stripe webhook ingress. It must not be connected to `dreamledger.org` or treated as accepted. This is a fail-closed scaffold used to make the migration gap testable without pretending the Node server has already been ported.

The next implementation work is to port each dynamic handler with equivalent auth, persistence, idempotency and response contracts; replace the blocked branches only after a test fixture and independent acceptance proof pass. Neon connectivity, write/read-back, data reconciliation and restore tests are separate gates. A provider deploy-hook response does not change those states.

Use Git integration or Wrangler for the correct Functions/Advanced Mode workflow after the project is configured. Do not use a dashboard static upload that drops Functions. Do not change production DNS, webhook routing, live checkout or payment rails during a preview-only task.

Provider secrets and database URLs belong in protected secret storage, not this folder, source control or chat.
