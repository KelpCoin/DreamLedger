# DreamLedger Distribution Execution

Status: ACTIVE

## Objective

Turn existing commercial surfaces into measurable customer acquisition without inventing reach, fake traffic or fake revenue.

## Primary offer order

1. DreamLedger 3000 Founding Billboard Tile - NZ$50
2. DreamMeez paid identity accessories
3. PHINHAVEN cosmetics after playable vertical slice proof

## Funnel

DISCOVERY -> LANDING PAGE -> OFFER -> CHECKOUT -> SETTLEMENT -> ATTRIBUTION -> FULFILLMENT -> PROOF

## Current public assets

- https://dreamledger.org/
- https://dreamledger.org/billboard
- https://dreamledger.org/dreammeez
- https://dreamledger.org/catalog

## Distribution surfaces

Search:
- sitemap.xml must contain all public commercial pages
- robots.txt must permit public discovery while excluding APIs/internal routes
- every commercial page should have a descriptive title, description, canonical URL and social metadata

Direct sharing:
- billboard offer is deliberately understandable in one screen
- price is visible before checkout
- product scope is explicit
- no guaranteed traffic/ROI claim

Community distribution:
- use communities where the offer is contextually relevant
- never spam
- never represent internal/test traffic as customer demand
- use a distinct landing URL or tracked referral parameter when technically supported

## Billboard message

The product is not sold as advertising performance. It is sold as a permanent public web placement on a finite canvas. The strongest buyer motivations are identity, curiosity, permanence, collectability, project discovery and being part of the founding board.

## Measurement

Track, where available:

- landing page views
- outbound checkout clicks
- checkout starts
- settled payments
- attributed orders
- fulfillment completion
- refunds
- publication completion

Do not call impressions, traffic, reach, conversions or revenue verified unless the corresponding evidence exists.

## Commercial target

First proof:

1 real external buyer
+
1 settled payment
+
1 attributed order
+
1 fulfilled billboard placement
+
1 proof artifact

First simple revenue milestone:

10 x NZ$50 billboard tiles = NZ$500 gross.

This is a target, not a forecast.

## Automation boundary

Cloud services can run the public site, checkout, webhook processing, database, fulfillment and evidence without the user's PC being online.

Local PC dependency remains only for local development/workers until those workloads are intentionally migrated to hosted infrastructure.

## Current deployment finding

The Render `DreamLedger1` dynamic service is configured for automatic deploys from main but its recent conversion commits are reporting `update_failed`. The separate `dreamledger-org` static site is live and auto-deploying from main. Therefore public static commercial pages remain the immediate distribution surface while the dynamic service deployment failure is treated as a separate engineering gate.

## Non-negotiable truth rule

Distribution automation may increase opportunities to discover the offer. It must never manufacture or simulate buyer activity and label it revenue.
