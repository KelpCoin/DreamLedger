# PROOF — Production surface exception — 2026-09-14

## Observed

- Live `/version` commit: `2323bd1f1b80f60b82d8c79d9a2145e0cee76fc7`
- Live surface header: `public-v15`
- Live `/healthz`: ok
- Live `/billboard`: **404**
- Live `/mtg`: **404**
- Main has newer commits including carousel restore and commercial page polish
- Deploy trigger committed: `.e0-render-trigger-20260914-surface-converge`

## Contract impact

Canonical Founding Tile doorway is not reachable on production.
This is a failed production check, not a success claim.
Revenue remains NZ$0 until attributable external payment evidence exists (E1_FIRST_EXTERNAL_PAYMENT / RA_000001).

## Required recovery

1. Render storefront service must deploy current main `public/`.
2. `/billboard` and `/mtg` must return 200 and serve the commercial HTML.
3. After convergence, re-verify Founding Tile Stripe checkout doorway.

## Non-claims

- No revenue inferred from health, traffic, or availability.
- No claim that the new main surface is live until `/version` SHA converges.
