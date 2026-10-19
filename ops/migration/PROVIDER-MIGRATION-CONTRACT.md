# BECK Provider Migration Contract

**Status:** IN_PROGRESS  
**Branch:** `beck/provider-migration-neon-cloudflare-20261019`  
**Authority:** Biggie confirmed 2026-10-19 — remove human from recovery loop.

## Non-negotiable requirements

1. Cloud surfaces stay operational when the PC is off.
2. When the PC is on, local GPU acceleration (figure-eight) remains available. Cloud is still source of truth.
3. Common failures (DB unreachable, origin non-200, custom domain degraded, compute suspended) are recovered by BECK via API. No dashboard clicks required from Biggie.
4. Every recovery attempt writes an immutable evidence artifact. Silent success is forbidden.
5. Fail-closed: if automated recovery fails after defined attempts, status stays BLOCKED with exact reason. No invented health.

## Target providers

| Layer | From | To | Recovery surface |
|-------|------|----|------------------|
| Database | Supabase Postgres | **Neon** | Neon API: restart / wake endpoint, scale, suspend_timeout |
| Static origin + custom domain | Render (`dreamledger-org`, `dreamledger.org`) | **Cloudflare Pages** | Cloudflare API: deploy, domain status |
| Control-plane heartbeat | Supabase Edge Function | Keep short-term; prefer Cloudflare Worker later | Health probe + optional redeploy |
| Local accelerator | Existing local heartbeat + GPU | Unchanged | Optional; never required for cloud liveness |

## Cutover gates (all must PASS with evidence)

1. Neon connection string accepted by heartbeat persistence + read-back.
2. Cloudflare Pages project serves origin 200 and Truth Oracle route 200.
3. Custom domain `dreamledger.org` returns 200 (not 503).
4. BECK recovery adapters can restart Neon compute and trigger Cloudflare redeploy without human credentials entry at runtime.
5. Existing acceptance gates updated to new endpoints and still fail-closed correctly.
6. No revenue or production payment claims made by this migration.

## Explicitly out of scope for this branch

- Full data migration of every historical Supabase table in one shot.
- Deleting Supabase or Render accounts.
- Changing Stripe or payment paths.
- Claiming verified revenue.

## Ordered jobs

1. **CONTRACT** (this file) — done when committed.
2. **NEON_SCHEMA** — minimal heartbeat + commercial tables on Neon.
3. **RECOVERY_ADAPTERS** — `ops/recovery/neon-endpoint.mjs` + `ops/recovery/cloudflare-pages.mjs`.
4. **WIRE_HEARTBEAT** — point persistence/read-back at Neon; keep dual-write optional until proven.
5. **STATIC_CUTOVER** — deploy current public surface to Cloudflare Pages; attach domain.
6. **GATE_UPDATE** — rewrite liveness + truth-heartbeat probes + recovery triggers.
7. **EVIDENCE_PASS** — run full BECK gates; only then mark Supabase/Render as deprecated.

## Worker rule

Any agent continuing this work must leave commit SHA + evidence path + exact next job. Biggie is not the default recovery operator.
