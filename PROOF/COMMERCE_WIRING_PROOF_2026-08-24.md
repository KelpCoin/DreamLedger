# Commerce Wiring Proof - 2026-08-24

Status: PASS for preparation layer

## Canonical rails

- GitHub: source of truth
- Stripe: canonical payment rail
- Super: preferred presentation layer, with Super-ready catalog content committed here and mirrored into Notion
- Consequential public actions: approval gated

## Stripe actions completed

- Existing Commander Deck Diagnostic verified at NZ$29 with live Payment Link.
- Personal Commerce Constitution Setup created at NZ$29 with live Payment Link.
- Observer created at NZ$9/month with live Payment Link.
- Analyst created at NZ$29/month with live Payment Link.
- Operator created at NZ$99/month with live Payment Link.
- White-Label Evidence World created at NZ$99/month with live Payment Link and approval-gated fulfilment metadata.

## GitHub actions completed

- Added catalog/commerce-catalog.json as machine-readable canonical sale manifest.
- Added catalog/SUPER-CATALOG.md as Super-ready public catalog copy.
- Added shop.html as a simple public Stripe commerce surface.
- Updated index.html to expose the canonical shop and Personal Commerce Constitution wedge.

## Explicitly blocked

- General commerce percentage fees.
- Marketplace settlement.
- Autonomous purchases without explicit policy/approval authority.
- Cross-silo inventory or metadata.

## Current main commit

7c9322a9ceae82fe85c85b734952f38eb59f9bc9

## Important deployment note

The previously supplied target SHA 199780570ce9c90ebc4af9422229b8e783f17e2b is now superseded by the commerce-wiring commits above. Deploying that older SHA would omit these changes. The release operator should target the current main commit after CI/deployment checks pass.
