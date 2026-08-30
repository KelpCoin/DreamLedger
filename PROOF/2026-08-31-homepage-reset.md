# DreamLedger homepage reset

Date: 2026-08-31

Status: CODE COMPLETE / PRODUCTION DEPLOYMENT NOT YET VERIFIED

Implemented on main:
- Replaced public/index.html with a catalogue-first, thumb-first storefront.
- DreamMee is confined to a small top-right interaction.
- Billboard is retained as a small pioneer product module and top-left discovery cue.
- Product discovery uses horizontal swipe rails.
- MTG is a product shelf, not the identity of the whole storefront.
- Removed homepage payment-logo clutter.
- Removed internal BECK PRIME, MCP, Gauntlet, Truth Oracle, Economic Court and RA_000001 language from the public homepage.
- Added GET /api/products as an explicit public catalogue projection through the storefront proxy.
- Kept engine credentials server-side.
- Aligned BEC-PRIME/surface/catalog.html with the same storefront.
- Updated public-surface verification contracts and Render production checks to match the new public surface.
- Bumped the public storefront contract marker to public-v5.

Evidence:
- public/index.html SHA: 9f773b6e21b3acf07dafe9fd32176649d14d718d
- public/server.js SHA: 2361c60f95ba027208a5b8e06abbd4129419ad41
- BEC-PRIME/surface/catalog.html SHA: 9f773b6e21b3acf07dafe9fd32176649d14d718d
- Latest homepage/workflow changes are committed on main.

Production truth:
- A live check of https://dreamledger.org on 2026-08-31 still returned the older DreamLedger 3000 billboard-first homepage.
- Therefore the repository is updated, but the new storefront has NOT been claimed as live.
- The repository contains an existing Render production workflow that is intended to deploy main and verify /version plus the public boundary.
- No claim of live deployment is made until that workflow or an equivalent production probe returns the new public-v5 surface.

Safety:
- No public social posting was performed.
- No payment was executed.
- No Stripe secret was exposed.
- RA_000001 remains unclaimed.
