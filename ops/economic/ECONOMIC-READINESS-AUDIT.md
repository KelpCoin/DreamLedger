# BEC / DreamLedger Economic Readiness Audit

**Snapshot date:** 2026-10-20  
**Audit mode:** read-only source inspection  
**Verified external revenue in the observed source snapshot:** NZ$0.00  
**Overall status:** BLOCKED for live commerce, BLOCKED for worker autoscaling, STAGED for silo cloning.

This audit distinguishes an implementation/configuration artifact from an operationally verified tenant. The registry contains one designated MTG master and 15 staged clone candidates. It does not create databases, DNS records, product rows, Stripe objects, inventory, or live workers.

## What is already present

| Surface | Source evidence | Result |
|---|---|---|
| Own-first commercial doctrine | `BEC-PRIME/OWN-FIRST-COMPANY-OPERATOR.json` | Updated in this branch to focus the first sale on the existing NZ$50 billboard tile, while keeping distribution blocked until checkout and fulfillment reconcile. |
| Billboard offer metadata | `BEC-PRIME/catalog/products/DREAMLEDGER-BILLBOARD-FOUNDING-001.json` | Product is `review_required`; `payment_link` is null and `evidence_status` is `checkout_held_missing_public_intake`. |
| Billboard public surface | `public/billboard.html` | HTML contains a Stripe URL and says checkout is live. That conflicts with the structured product metadata. An URL in HTML is not proof of a configured/working fulfillment path. |
| Avatar cosmetics | `public/avatar.html` | The per-cosmetic `Unlock demo` flow is local; the real cash link is a separate NZ$3.99 supporter SKU. It is not evidence that individual cosmetic SKUs settle and grant matching entitlements. |
| MTG diagnostic SKU | `BEC-PRIME/catalog/products/COMMANDER-DECK-DIAGNOSTIC-001.json` | Held; checkout mode disabled; fulfillment mode disabled; operator required; no inventory. NZ$29 is a configured price, not a buyable offer. |
| MTG fulfillment registry | `BEC-PRIME/fulfillment/PRODUCT-FULFILLMENT-REGISTRY.json` | The base branch incorrectly claimed `ready: true` while the SKU was held. This branch aligns the entry to `ready: false` and `operator_required: true`, so it remains closed. |
| MTG gate | `.github/workflows/mtg-diagnostic-fulfillment.yml` | The base gate falsely required automation mode even when a product was intentionally held. This branch accepts either a consistent production-ready state or a consistent held/disabled state. Passing the gate does not enable checkout. |
| Revenue doctrine | `BEC-PRIME/OWN-FIRST-COMPANY-OPERATOR.json` | Counts no checkout start, link, internal event, database row, test, simulation, or generated artifact as revenue. Revenue remains NZ$0 in the inspected source snapshot. |

## Specific CI evidence observed

The inspected PR #777 baseline was mixed, not green overall:

- **BECK Provider Migration Contract:** passed (run #79).
- **BECK Fleet Contract:** passed (run #72).
- **MTG Diagnostic Fulfillment Gate:** failed (baseline run #7002) because the workflow required `fulfillment.mode=automated` even though the product was explicitly held. This branch corrects the contract while keeping checkout disabled.
- **DreamLedger E-Commerce Smoke:** failed (run #6682).
- **Cortex CI/CD Live Release Gate:** failed (run #7383), with the forensic output marking Supabase-backed inventory, server-side Stripe checkout and paid activation webhook checks as failing.
- **Public Surface Guard:** failed (run #6681) on prohibited internal/historical terms in three public HTML files.

The dedicated BEC economic suite passed 16 tests and emitted a machine-readable audit marked `BLOCKED`, with 13 passing checks and 13 unresolved blockers at the last inspected code head. Other repository workflows remain red. These checks are evidence of source/build status, not proof of live payment or revenue. Run results must be rechecked against the latest exact commit before merge or release.

## BEC files not available as executable source in this repository snapshot

The following basenames were not found as active tracked source in `KelpCoin/DreamLedger` during this audit:

- `schema_nz_mtg_silo.sql`
- `seed_nz_mtg.sql`
- `cube_swarm_scaler.py`
- `bec_tenant_spawner.py`
- `schema_domino02_fencing.sql`
- `beck_engine_rebuilt.py`
- `silo-migration-10-domains.sql`

They may exist in a Studio-only workspace or another repository, but they were not available here for execution, hash comparison, or static validation. The claimed P2P trade query, automated vouch counter and CUBE benchmark are therefore **not independently reproduced** by this audit.

The sample fossil hash `e3b0c442...b855` equals SHA-256 of empty bytes. Unless the value is computed from a canonical, non-empty trade-state payload and the payload/hash relationship is retained, it does not seal the stated transaction state.

## Clone strategy implemented by this branch

`ops/economic/silo-clone-registry.json` stages **16 silo configurations**: the designated `nz-mtg` master plus 15 clone candidates (music/media, women's clothing, baby/kids, books/comics, gaming/collectibles, electronics, home/furniture, tools/trades, sports/outdoors, toys/hobbies, free B2B, procurement/ETA, local services, arts/crafts and musical instruments).

Every clone is configuration-only. All listing fees and transaction take-rates start at 0% for liquidity bootstrap; this is a proposal, not a claim that a live database or domain already enforces it. Each proposed domain remains unprovisioned, each database tenant remains unprovisioned, RLS remains unverified, and launch authorization stays false.

The intended implementation is **one shared marketplace contract with mandatory `silo_id` partitioning and explicit RLS**, not 15 copied databases, credential sets or inventories. MTG remains the master reference. Clones may be prepared now, but none is declared ready to launch until the master passes its own tests.

## CUBE scaling policy

The manifest records the requested EPV policy (NZ$25 pruning floor, NZ$120 expansion threshold, 64-worker ceiling) as **proposed and not validated against a connected runtime**. Scaling is disabled. There is no claim that 64 worker processes exist. The added `ops/economic/cube_epv_gate.py` requires HMAC-SHA256 attestation for a reconciled ledger export, 20 settled-and-fulfilled transactions over at least 30 days, and explicit runtime/queue/fencing/replay/budget gates. It calculates net contribution EPV, emits `WOULD_*` decisions only, and has `APPLY_ENABLED = False`; it never invokes a worker provider. Without the trusted reconciler key and a live runtime, it returns `HOLD_NO_SCALE`.

The EPV input must be measured net contribution: settled attributed revenue minus refunds, provider fees and variable fulfillment costs, divided by unique qualified visitors over a defined window. Pipeline value, predicted conversion, local simulation throughput, hashes alone and traffic volume cannot drive live expansion. A conservative proposal is to require at least 20 independently settled-and-fulfilled transactions over a 30-day window before expansion is considered, plus durable queue, fencing, tenant-boundary, worker health, budget and rollback evidence.

## Immediate dependency order

1. Reconcile billboard product metadata, Stripe checkout fields, public intake, payment attribution, inventory reservation, human review and retrievable placement receipt. Keep all distribution in `PREPARE_ONLY` until each item passes.
2. Resolve the avatar demo-vs-paid SKU mismatch: one real SKU must map to one specific entitlement, settlement and receipt.
3. Restore/commit the authoritative MTG schema and seed as code; test RLS cross-tenant negatives, locking, fees, vouches, replay, refunds and a non-empty deterministic fossil payload in a disposable database.
4. Keep the 15 clone candidates staged until the MTG master gates pass; then clone only configuration/schema shape, never production data or credentials.
5. Locate and review the actual CUBE scaler, tenant spawner and DOMINO_02 implementation before enabling any worker execution. Maintain one-worker maximum policy until live economics and a real provider are verified.

## Safety and economic boundary

No database migration, production deployment, DNS change, Stripe mutation, outbound outreach, provider resource creation or live worker scaling was performed by the source audit. Verified revenue remains NZ$0.00 until an independent external settlement, correct attribution, fulfilled deliverable and retrievable proof reconcile to the same transaction.
