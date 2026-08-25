# DreamLedger Billboard Founding Tiles GTM

Date: 2026-08-25
Status: EXECUTION

## Product

Founding Tile: NZD 50 one-time.

Size: 100x100 pixels.

Larger blocks:
- 200x100: NZD 79
- 500x200: NZD 149
- 500x500: NZD 349
- 1000x1000 takeover: NZD 999

Publication is payment-confirmed and human-review gated.

## Market editions

- Global: /billboard
- New Zealand: /billboard/nz
- Australia: /billboard/au
- South Africa: /billboard/za
- Americas: /billboard/americas
- Europe: /billboard/europe

Each edition has a separate 1000x1000 logical inventory surface in the same Supabase campaign table, scoped by `market`.

## Why these editions

The regional split is intentionally operational rather than theoretical. New Zealand and Australia are the first nearby commercial markets. South Africa gives a distinct Southern Hemisphere English-speaking market. Americas and Europe provide broad high-value advertiser pools without pretending that every country needs its own board on day one.

Asia-Pacific remains a future expansion lane after evidence exists. Do not create additional regional surfaces until one of the current editions demonstrates demand.

## Current implementation

- Stripe checkout remains the existing payment rail.
- Checkout now accepts a market and writes market metadata.
- Stripe signed webhook persists the market with the paid campaign.
- Inventory API is market-scoped.
- Public routes resolve to the existing compiled billboard surface and infer the market from the path.
- Existing geometry allocator is retained.
- Existing PAID_PENDING_REVIEW state is retained.
- Existing human review requirement is retained.

## Pricing doctrine

NZD 50 is the public founding price for 100x100.

Do not introduce a permanent discount before the first-sale experiment. If an early-adopter or professional discount is tested later, make it a bounded campaign with a named code, expiry, and maximum redemptions so the public anchor remains NZD 50.

## DOOH evidence

The US OOH market reached record revenue of USD 9.46B in 2025, with DOOH representing 36.3% of OOH revenue and growing 10.5% year over year. In Q2 2026, US OOH revenue reached USD 3.16B and DOOH grew 18.5% year over year to 38.4% of quarterly OOH revenue. These figures establish that digital out-of-home is a growing advertising channel, but they do not validate DreamLedger demand by themselves.

The IAB's 2025 DOOH Measurement Guide emphasizes standardized measurement and comparability as the category matures. DreamLedger should therefore capture durable evidence from day one: market, tile geometry, purchase timestamp, destination URL, publication timestamp, and later click/traffic evidence where available.

ANZ evidence is also relevant: oOh!media reported 1H 2025 group revenue growth of 17%, programmatic revenue growth of 38%, and strong New Zealand retail growth. This supports testing NZ and Australia as adjacent launch markets, while still requiring actual buyer evidence before expansion.

## Acquisition sequence

1. Publish the global billboard and regional index links.
2. Acquire the first external buyer, not internal test revenue.
3. Capture the buyer's market, creative, destination, and acquisition source.
4. Publish only after human review.
5. Turn the first published tile into proof material.
6. Contact 20 prospects across creators, small businesses, indie brands, agencies, and internet-native projects.
7. Scale the best-performing market only after measured conversion evidence.

## Commercial truth gate

GREEN requires:
- public route reachable
- inventory API reachable
- Stripe checkout creates NZD 50 for Founding Tile
- signed webhook persists PAID_PENDING_REVIEW
- human approval can publish
- published tile appears on the correct market surface
- durable proof records payment and delivery

No claim of launch-ready status is allowed until these conditions are live-verified.
