# Internet Billboard Permanent-3000 Assembly Proof

Date: 2026-08-27
Experiment: EXP-2026-08-27-001

## Commercial state

- Product: Internet Billboard - Permanent 100x100 Placement
- Standard price: NZ$50 one-time
- Standard footprint: 100x100 = 10,000 pixels
- Canvas: 1,000,000 pixels = 1000x1000
- Retention promise: until January 1, 3000
- Publication gate: PAID_PENDING_REVIEW -> human approval -> PUBLISHED
- Image add-on: NZ$100, manual approval required
- No subscription
- No crypto
- No fake sold counters
- No invented traffic claims

## Stripe evidence

- Live product created in DreamLedger livemode
- Live standard Payment Link: https://buy.stripe.com/00w9ATaXP3dzaar9EUdwc2r
- Payment Link ID: plink_1U8xDOEGgEAnUFF9n08bpldm
- Standard Price ID: price_1U8xD6EGgEAnUFF9KGrq2t7X
- Image add-on Price ID: price_1U8xF6EGgEAnUFF9ghEjKtv7
- Old 30-day billboard links deactivated
- Old NZ$29 billboard link deactivated
- Older permanent-but-wrong billboard link deactivated

## Allocation evidence

- Supabase project: DreamLedger
- New table: public.billboard_placements
- Canvas bounds enforced: 0..1000 on both axes
- Placement dimensions constrained to 25px increments
- PostgreSQL GiST exclusion constraint prevents overlapping active placements
- Transaction-scoped advisory lock serializes allocation
- Allocation function: public.billboard_allocate_position(width,height)
- Public reads expose published placements only through RLS

## Webhook evidence

- Function: dreamledger-billboard-webhook
- Status: ACTIVE
- Endpoint: https://wbwgroygjeyukkspnqiy.supabase.co/functions/v1/dreamledger-billboard-webhook
- Stripe event: checkout.session.completed
- Payment flow: verified Stripe payment -> allocation -> PAID_PENDING_REVIEW
- No placement is published automatically

## Public surface evidence

- Root index.html replaced with permanent-until-3000 billboard surface
- /billboard route added
- GitHub Pages workflow updated to validate NZ$50, new Payment Link, and permanent-until-3000 copy
- Pages workflow is configured to deploy from main
- Public-domain convergence remains pending verification after the latest commits

## Truth status

PAYMENT LINK: PASS
PRODUCT SPEC: PASS
ALLOCATION SCHEMA: PASS
OVERLAP GUARD: PASS
REVIEW GATE: PASS
OLD 30-DAY RAIL: DEACTIVATED
PUBLIC DEPLOYMENT: PENDING EXTERNAL CONVERGENCE CHECK
CUSTOMER: 0 PROVEN
REVENUE: NZ$0 PROVEN

## Verification

1. Open the live Payment Link and confirm the checkout shows the NZ$50 standard placement and optional NZ$100 image add-on.
2. Open https://dreamledger.org and confirm the headline says permanent until 3000 and the CTA is NZ$50.
3. In Supabase, confirm public.billboard_placements has zero PUBLISHED rows before the first sale.
4. After a real sale, verify the Stripe checkout.session.completed event creates exactly one PAID_PENDING_REVIEW placement with a non-overlapping 100x100 position.
5. Approve manually before publication.
