# Toll Road Traversal Proof - 2026-10-02

Objective: monetize existing DreamLedger substrate as autonomous digital toll roads, with zero owner minutes after payment.

Observed existing substrate:
- CandidateGauntlet: deterministic candidate validation and proof generation.
- BridgeRail: signed HMAC lease envelopes, live DB fencing, independent Worker B verifier.
- Truth Oracle commerce: existing paid entitlement and Stripe webhook boundary.
- Toll Booths: existing public one-time payment surfaces for quote comparison, document extraction, supplier verification and evidence packets.
- C2 Decision: existing paid digital fulfillment with canonical settlement checks.
- Public commerce spine: Stripe checkout + webhook + fulfillment/economic truth separation.

Commercialization move:
- Added a scoped signed toll-key primitive.
- Added fail-closed API wall.
- Added automated Gauntlet service route.
- Added evidence-state service route explicitly bounded so it cannot create economic truth.
- Added customer-initiated Stripe Checkout creation when a dedicated toll price is configured.
- Added settlement check before key redemption.
- Added public toll-road storefront and machine manifest.
- Customer toll keys cannot access internal BridgeRail lease authority.
- No manual audit queue is required for these automated services.

Files:
- BEC-PRIME/runtime/TollRoad.js
- BEC-PRIME/runtime/TollRoad.test.js
- BEC-PRIME/routes/tollRoad.js
- public/toll-road.html
- public/toll-road.json

Commits:
- ad0334bd7702be59826449531a2f8b87bc6f8878
- a989969c826df18ac89854311e17d5f75c46bc38
- 5b31951268d88fe3007af9dd5efe32f3bde6564d
- 382f0dccfe9cf921b7c204a8bfa49ab19102faef
- 93f43f781749185f4904f1c726de56408b28345d
- d78d99a1761cc94753811d28d3f75e29b2187958
- be55d7819132a8ee2307e5560623f4b33be84fdc
- eb1dcd45b353ce7134f0f58756909bae56f41ede
- 0d091b24debd31876d3400b5b9fa329d1592adeb

Stripe live inventory was inspected read-only. Existing active NZD prices include:
- DOC-EXTRACT-50: NZ$5
- SUPPLIER-CHECK-50: NZ$5
- EVIDENCE-PACKET-10: NZ$10
- QUOTE-COMPARE-49: NZ$49
- SELLER-PROFIT-AUDIT-001: NZ$29
No dedicated Gauntlet or Truth Oracle toll-key price was identified by metadata search.

Current blocker:
DEDICATED_STRIPE_ENTITLEMENT_PRICE

The code is therefore armed but fail-closed. It will not pretend an adjacent product is a Gauntlet or Truth Oracle purchase. Once dedicated prices are configured as environment values:
DREAMLEDGER_GAUNTLET_PRICE_ID
DREAMLEDGER_TRUTH_ORACLE_PRICE_ID
the customer path is:
CHECKOUT -> LIVE PAID SESSION -> SCOPED SIGNED KEY -> API WALL -> AUTOMATED SERVICE.

No Stripe mutation was performed in this traversal.
No customer key was fabricated.
No revenue or settlement was manufactured.
No internal worker authority was exposed.

Economic scoreboard remains:
VERIFIED_EXTERNAL_REVENUE = NZ$0.00
SETTLED_EXTERNAL_PAYMENTS = 0
INDEPENDENT_EXTERNAL_BUYERS = 0
VERIFIED_ECONOMIC_OUTCOMES = 0
