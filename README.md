# DreamLedger

DreamLedger is the public commerce surface and economic evidence doorway.

The public website now has one continuous front door:
- free cost-of-living intelligence, beginning with cheaper power
- public Truth Oracle evidence
- direct paid offers
- machine-readable commerce discovery

The commercial rule is simple: **free useful information earns attention; verified evidence earns trust; clear offers earn transactions.**

## Public architecture

`PUBLIC SURFACE → TRUTH ORACLE → SHOPPING / OFFERS → CHECKOUT → FULFILMENT → PROOF`

The public surface is intentionally not a maze of portals. Secondary legacy routes may remain for compatibility, but the homepage is the canonical doorway.

## Agentic commerce

DreamLedger publishes a UCP business profile at `/.well-known/ucp` and exposes machine-readable offers at `/api/offers`. UCP is the interoperability target for agentic commerce; the public surface must not claim capabilities that are not deployed.

## Verification

The public-surface gate validates the public contract, catalogue fields, homepage continuity, Truth Oracle boundary, UCP profile, and forbidden private/internal tokens.

Run:

`node public/verify-public-surface.js`

The gate runs in GitHub Actions and during the Render build.
