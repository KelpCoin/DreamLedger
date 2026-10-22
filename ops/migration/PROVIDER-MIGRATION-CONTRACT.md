# BECK Provider Migration Contract

**Status:** IN_PROGRESS  
**Branch:** `beck/provider-migration-neon-cloudflare-20261019`  
**Owner direction (2026-10-19):** remove Render from the target runtime; cloud must operate PC-off; Figure Eight/local GPU remains an optional accelerator only.

## Current branch artifacts
- Initial contract / minimal Neon schema / recovery adapters were started at commit 23978e3bf57f1e4c1374b92f3440b24f69c5a949.
- This branch adds a route-parity contract, inspect-first recovery adapters, secretless contract tests and a non-production Cloudflare preview scaffold.
- These are source and preview artifacts, not proof that Neon or Cloudflare projects exist, production moved, database persistence works or BECK has completed autonomous recovery.

## Correct migration shape
- Cloudflare Pages serves static assets.
- Cloudflare Pages Functions or Advanced Mode Worker must preserve dynamic APIs and forward static requests through its Assets binding. The current public Node server is not a drop-in static site.
- Neon is the target transactional database, only after a scoped schema/data migration and read/write/read-back proof.
- Cloud-scheduled execution is primary; the local GPU must never be required for liveness.
- Render should stop being the *target* deployment dependency. Do not spend more build attempts on its exhausted quota.

## Dynamic runtime compatibility is mandatory
The current public server supports /healthz, /version, product/offer APIs, Agent Bridge/toll APIs, Stripe webhook handling, the internal engine proxy and durable state. A static-only upload could render the page while silently breaking payment, inventory and health contracts. The new preview scaffold therefore returns HTTP 503 for not-yet-ported dynamic routes rather than reporting fake health or accepting money.

Cloudflare references:
- https://developers.cloudflare.com/pages/functions/get-started/
- https://developers.cloudflare.com/pages/functions/advanced-mode/
- https://developers.cloudflare.com/pages/functions/routing/

## Automatic recovery rules
1. Default adapter action is read-only inspection.
2. Mutations require a specific action plus BECK_ALLOW_PRODUCTION_RECOVERY=true in a protected execution context with least-privilege secrets.
3. Never retry provider POST mutations automatically; persist before/action/after evidence without credentials.
4. Neon start/restart request is not DB health. Require an actual SQL probe, correlated write/read-back, idempotency and restore proof.
5. Cloudflare deploy-hook response is not service health. Require deployment identity, route tests, origin/domain probes, persistent state and DB acceptance.
6. Unknown state, missing credentials, route failure or missing read-back remains BLOCKED.

## Ordered acceptance
1. Contract tests and safe preview build pass without provider secrets.
2. Port and verify the full dynamic route contract, headers, cache behavior, signed webhook handling and idempotency.
3. Migrate only the documented schema/data scope; reconcile record counts, stable identifiers and content hashes in an isolated target.
4. Verify Neon SQL connectivity, write/read-back and backup/restore.
5. Deploy a non-production preview and probe every route, including MTG manifest/catalogue.
6. Prove rollback/export and live-domain routing without changing production DNS.
7. Only after all evidence passes may the owner authorize production domain/payment path cutover.
8. Keep existing data and provider accounts intact until post-cutover checks and rollback are proven.

## Silo and economics boundaries
- Happy Homarid Patreon is the creator-membership/time-sensitive community layer for CUBE/Swarm.
- DreamLedger /mtg is the public marketplace/catalogue/evidence-quality reference layer.
- Clones reuse structure and tested workflow, never audience/member data, inventory, credentials, payment links, analytics or customer records.
- MTG/Happy Homarid/CollectorsCoast remain siloed from Amplissa/adult. Public posts stay approval-gated.
- Verified revenue remains NZ$0.00 without independent settled payment, correct attribution, fulfilment and retrievable delivery proof.

## Status at this commit
**NOT CUT OVER.** This work does not create provider accounts, store secrets, deploy production, change DNS, mutate Stripe, write the target database, or claim revenue. The branch's route contract remains BLOCKED until real runtime implementation and preview probes pass.
