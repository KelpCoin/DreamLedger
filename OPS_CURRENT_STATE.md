# DreamLedger / PHINHAVEN Execution State

Updated: 2026-09-15

## LIVE

- `dreamledger.org` public static site is live on Render.
- Billboard offer is publicly visible at `/billboard`.
- Billboard price is NZ$50 one-time.
- Stripe checkout link is present on the public billboard page.
- DreamMeez identity surface is publicly visible at `/dreammeez`.
- GitHub is the canonical control plane.
- Supabase is the intended authoritative data/evidence layer.

## DEPLOYMENT

- Render static service `dreamledger-org`: LIVE, auto-deploy enabled.
- Render dynamic service `DreamLedger1`: auto-deploy enabled, recent conversion commits currently report `update_failed`.
- Do not treat the dynamic service as healthy until its deployment failure is diagnosed and a live deploy passes.

## COMMERCIAL

- Billboard: publicly sellable surface, BusinessTruth UNVERIFIED.
- DreamMeez accessories: identity surface exists, paid accessory offer/fulfillment still requires a verified product path.
- PHINHAVEN: game runtime not yet present in canonical repository, so game monetization is downstream of runtime recovery.

## PHINHAVEN

`PHINHAVEN_RECON_V0.1.json` remains BLOCKED_PENDING_CANONICAL_RUNTIME.

Next game action: locate/recover/import the actual Godot runtime, reconcile it, then implement only the smallest missing vertical-slice systems.

## MONEY

Verified PHINHAVEN revenue: NZ$0.

Do not promote test/simulated/internal/unmatched activity to revenue.

## USER PC

Not required for hosted static site or Stripe checkout itself.
Required for local Godot development and local workers until those workloads are hosted.

## EXECUTION ORDER

1. Keep public static commerce live.
2. Diagnose and repair DreamLedger1 deployment failure.
3. Prove billboard payment -> attribution -> fulfillment -> evidence.
4. Turn one DreamMeez accessory into a real paid entitlement.
5. Recover PHINHAVEN runtime.
6. Prove PHINHAVEN vertical slice.
7. Add PHINHAVEN cosmetic commerce.
8. Scale only after proof.
