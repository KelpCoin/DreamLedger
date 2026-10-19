# MTG master silo: clone-readiness gate

**Current decision: HOLD production cloning.** MTG is the intended reference implementation, not yet a validated production template.

## What was inspected

- Repository MTG catalog endpoint: `supabase/functions/mtg-deck-catalog/index.ts`.
- DreamMeez commerce ownership migration: `supabase/migrations/20260822_dreammeez_cross_game_items.sql`.
- Active Supabase project metadata and Edge Function inventory.
- Supabase SQL reads and security/performance advisors were attempted but refused the database connection. Project control-plane status alone does not prove database schema or policy health.

## Findings that block clone-upscale

1. **Publication gate:** the old MTG endpoint defaulted `publish` to true for authenticated uploads. The branch change holds all uploads as drafts until an explicit review process exists. Social copy generation is not publication authorization.
2. **Held-offer checkout mismatch:** the Commander diagnostic product contract says `held`, inventory `0`, checkout disabled, and fulfillment disabled, but the canonical and compiled MTG pages contained a direct Stripe payment link. The branch removes the link and shows a held status instead; a regression test checks both pages. This is not deployed.
3. **Entitlement security:** the DreamMeez ownership migration adds a self-insert RLS policy. The branch adds a follow-up migration that removes write policies and client write grants while preserving self-read. This is staged source code, not yet applied to the live database.
4. **Purchase-to-delivery:** the inspected cosmetic checkout creates a Stripe Checkout Session, but it does not itself grant ownership. A signed, idempotent payment event plus trusted fulfillment and retrievable delivery must be proven end-to-end.
5. **Live verification:** current database state, effective grants, live RLS policies, indexes, and advisor findings remain unverified while SQL connectivity fails.
6. **Economics:** no independently evidenced settled sale, attributed buyer, fulfilled order, and retrievable delivery proof has been confirmed. Conversion, LTV, repeat demand, contribution margin, and acquisition cost remain unvalidated.

## Mandatory promotion gates

Every gate must carry a retrievable PASS artifact. UNKNOWN, CI success, a catalog row, checkout creation, test payment, or internal webhook observation is not a pass for external economic truth.

- Client roles cannot grant, alter, or delete paid ownership.
- Signature verification, event uniqueness, concurrent duplicate handling, and retry safety are tested.
- Settlement is matched to an approved SKU/offer, silo, expected amount/currency, Checkout Session, and attributable buyer.
- Fulfillment and entitlement/inventory mutation are atomic or safely idempotent.
- The buyer can retrieve the purchased digital entitlement or independently evidenced physical delivery.
- Duplicate, delayed, unpaid, refunded, disputed, and failed-fulfillment paths are tested.
- Human review is required before any public listing or distribution.
- Clones inherit schemas and contracts, not credentials or another silo's inventory, evidence, buyers, or analytics.
- Observability, rate/load behavior, backup/restore, and recovery procedures are demonstrated.
- At least one real buyer cycle is independently reconciled; repeatable demand and unit economics are then measured.
- A clean clone dry-run passes CI and does not touch production.

## Newly confirmed release blockers (19 October 2026)

- **Duplicate app payment rails:** the same Commander Diagnostic had several distinct Stripe URLs in product/offer, featured-offer, live-commerce, marketing, and machine-discovery files. Source/config references are held in this branch; the actual Stripe Payment Link objects have not been deactivated or verified.
- **Canonical data beats old offer projections:** the prior product-offer compiler copied `commercial_truth.payment_link` even when checkout was blocked. The source compiler now emits a checkout URL only when the canonical product is published, explicitly sellable, operator-approved, in stock, checkout-enabled, schema-valid, and fulfillment-ready.
- **EDH_0001 price conflict:** canonical source is NZ$400 (40,000 minor units) while public catalog lists NZ$230. The product, configurator, and public feeds are held. No guessing at price and no purchase route.
- **Public machine feeds:** public agent-commerce discovery previously labelled the diagnostic and EDH_0001 as available/verified. The branch changes them to held, with no buy route.
- **Economic status:** verified external revenue remains NZ$0.00 in the contract. No end-to-end independent buyer cycle is proven.
- **Live-state limit:** Supabase SQL and advisor reads returned `ECONNREFUSED`. Static repo changes and passing CI cannot establish what production is currently serving. The actual Stripe-hosted URLs may remain active unless disabled separately in Stripe.

## Release rule

No new production clone is authorized by this contract. First make the MTG checkout-to-delivery path correct and observable, restore safe live database inspection, then prove it with a real independent buyer. Only the reusable, tested parts may then be cloned.

The remediation code in this branch is **staged, not deployed**. No production database change, payment, publication, or external distribution was performed by this audit.
