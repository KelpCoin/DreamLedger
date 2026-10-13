# DreamLedger Music & Media silo

## Decision

Music & Media is the next silo cloned from the MTG reference pattern. Its public route is `/music-media/` on `dreamledger.org`, served by the existing DreamLedger deployment path. Do not create another standalone Render service.

## Shared stencil

- Mobile-first catalogue and listing cards
- One silo-specific catalogue feed
- Shared DreamLedger identity and account path
- Shared checkout infrastructure, with listing-specific checkout gates
- Explicit creator credits, ownership/distribution rights, exact deliverables, price, availability, accessibility, refund terms, and delivery evidence
- Public listings are hidden unless `status=published`
- Buy is enabled only when a Stripe Payment Link is verified and both rights and delivery status are verified
- No invented releases, placeholder payment links, unlicensed downloads, or claims of verified revenue without independent settlement and fulfillment evidence

## Catalogue state

The initial catalogue is intentionally empty. The storefront is implemented, but no music/media listings or revenue are claimed. This is not a blocker to cloning the reusable surface; it is a truthful launch state.

## Commercial policy

The silo is registered as `MUSIC_MEDIA`, ID `dreamledger-music-media`, with the canonical non-MTG platform fee of 500 basis points (5%). Fees must be resolved server-side. Do not implement browser-supplied commission overrides.

## Promotion gates

1. Verify root and `public/` copies are identical.
2. Validate the catalogue JSON and ensure the empty state renders cleanly.
3. Run the existing silo boundary and empire silo verifiers.
4. Merge through review; Render auto-deploys from `main`.
5. Verify `/music-media/` over HTTP after deploy.
6. Enable no checkout until rights, Stripe URL, settlement attribution, and delivery are verified.
