# Public Homepage Repair Proof

Date: 2026-09-01

Observed repository state:
- Render root service is configured with rootDir: public.
- public/index.html was still the old "Discover things worth buying" / Magic & collectibles storefront.
- The newer avatar accessories + digital billboard homepage existed only under BEC-PRIME/compiled/website/index.html, which is not the root storefront served by the public Render service.
- public/server.js did not expose the plural /avatars route.

Changes made:
- Replaced public/index.html with a customer-facing homepage for avatar accessories and digital billboard advertising.
- Added /avatars and /avatars/ aliases to public/server.js.
- Kept the existing /avatar route working.
- No payment, Stripe configuration, webhook logic, or MTG backend code was changed.

Commits:
- f19da9f22552c0d5a5268b634e3d3214eebfdebb
- 6e081fb7915c87498a7f67416960d2fdd7f5c6c4

Live observation at repair time:
- https://dreamledger.org/ still returned "Dream Ledger Deck", proving production had not yet picked up the repaired public/index.html.

Required deployment verification:
- GET https://dreamledger.org/
- GET https://dreamledger.org/version
- Expected homepage heading: AVATAR ACCESSORIES. DIGITAL BILLBOARDS.
- Expected /version commit: 6e081fb7915c87498a7f67416960d2fdd7f5c6c4 (latest main commit).

Acceptance:
- Production homepage no longer presents the MTG deck as the main storefront.
- /avatars resolves to the avatar storefront.
- /billboard remains the billboard purchase path.
