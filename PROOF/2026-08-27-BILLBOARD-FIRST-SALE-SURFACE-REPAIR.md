# Billboard First-Sale Surface Repair

Date: 2026-08-27

## Commercial objective
Replace the previous multi-world brochure homepage with one explicit, buyable Billboard offer.

## Changes
- Root `index.html` is now a focused Internet Billboard sales page.
- Offer: one founding tile for NZ$15 for 30 days.
- Checkout: live Stripe Payment Link `https://buy.stripe.com/3cI4gz9TL7tPbev9EUdwc2n`.
- Board: 100 visual tiles, each routing to the same checkout for the first-sale test.
- Fulfilment promise is explicit: buyer supplies image and destination URL; manual review and publication within 24 hours.
- No fake social proof, fake sold counters, subscriptions, or invented traffic claims.
- GitHub Pages workflow was repaired so it validates the new commercial surface instead of the obsolete NZ$29 MTG homepage.
- Existing `CNAME` remains `dreamledger.org`.

## Stripe evidence
Live payment link created in the connected DreamLedger Stripe account:
- Payment Link ID: `plink_1U8v9gEGgEAnUFF9UHKFCyLG`
- Currency: NZD
- Unit amount: NZ$15.00
- One-time payment
- Active: true
- Completed-session inventory limit: 100

## GitHub evidence
- Homepage repair commit: `af65ebf2a41fae9d3965d6a28e14e75a6d1888cb`
- Pages workflow repair commit: `cac324158903e9247bdc4a7bf04a28d382266fa2`

## Important limitation
At the time of sealing this proof, `https://dreamledger.org` still returned HTTP 503 from external fetch. The GitHub source and Pages workflow have been repaired, but public DNS/Pages convergence is not yet proven.

## Commercial status
PAYMENT LINK: PASS
SOURCE SURFACE: PASS
PAGES WORKFLOW CONTRACT: PASS
PUBLIC DOMAIN: UNPROVEN / 503
CUSTOMER: 0 PROVEN
REVENUE: NZ$0 PROVEN
