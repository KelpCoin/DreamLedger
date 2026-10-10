---
type: observation
observation_id: OBS-20261010-001
pain_class: commerce-recovery
channel: internal
created_at: 2026-10-10T13:00:00Z
confidence: high
---

# Observation: First-dollar track status (2026-10-10)

## Signal

Live Stripe scan on DreamLedger account (`acct_1SNVPvEGgEAnUFF9`, livemode):

- Complete paid sessions: 2 (NZ$5 + USD$1)
- QUOTE-COMPARE-49 / NZ$49 matches: **0**
- Verified external revenue: **NZ$0.00**

Public storefront healthz and `/api/offers` are up. Supabase data plane not observed on `dreamledger.org`.

Payment Link mismatch: site uses `buy.stripe.com/14AdR97LD6pLfuLdVadwc32`; active link with `dreamledger_sku: QUOTE-COMPARE-49` and quote-intake redirect is a different URL.

## Implications

1. Checkout doorway is live; first-dollar event has not occurred for QC-49.
2. Align storefront URL + Payment Link metadata before relying on webhook SKU resolution.
3. Database recovery remains a separate gate from storefront health.

## Follow-up

- [ ] Payment Link / metadata alignment (human gate)
- [ ] Data-plane recovery when project host available
- [ ] Do not treat this note as settlement evidence
