# MTG master silo: clone-readiness gate

**Current decision: HOLD production cloning.** MTG is the intended reference implementation, not yet a validated production template.

## What was inspected

- Repository MTG catalog endpoint: `supabase/functions/mtg-deck-catalog/index.ts`.
- DreamMeez commerce ownership migration: `supabase/migrations/20260822_dreammeez_cross_game_items.sql`.
- Active Supabase project metadata and Edge Function inventory.
- Supabase SQL reads and security/performance advisors were attempted but refused the database connection. Project control-plane status alone does not prove database schema or policy health.

## Findings that block clone-upscale

1. **Publication gate:** the old MTG endpoint defaulted `publish` to true for authenticated uploads. The branch change holds all uploads as drafts until an explicit review process exists. Social copy generation is not publication authorization.
2. **Entitlement security:** the DreamMeez ownership migration adds a self-insert RLS policy. The branch adds a follow-up migration that removes write policies and client write grants while preserving self-read. This is staged source code, not yet applied to the live database.
3. **Purchase-to-delivery:** the inspected cosmetic checkout creates a Stripe Checkout Session, but it does not itself grant ownership. A signed, idempotent payment event plus trusted fulfillment and retrievable delivery must be proven end-to-end.
4. **Live verification:** current database state, effective grants, live RLS policies, indexes, and advisor findings remain unverified while SQL connectivity fails.
5. **Economics:** no independently evidenced settled sale, attributed buyer, fulfilled order, and retrievable delivery proof has been confirmed. Conversion, LTV, repeat demand, contribution margin, and acquisition cost remain unvalidated.

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

## Release rule

No new production clone is authorized by this contract. First make the MTG checkout-to-delivery path correct and observable, restore safe live database inspection, then prove it with a real independent buyer. Only the reusable, tested parts may then be cloned.

The remediation code in this branch is **staged, not deployed**. No production database change, payment, publication, or external distribution was performed by this audit.
