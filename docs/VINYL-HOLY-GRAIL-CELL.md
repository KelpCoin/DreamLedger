# Vinyl Holy Grail Finder

This is an economic cell inside DreamLedger. It is not a claim of arbitrage profit.

## Core job

Given a precise wanted record, identify live listings and rank them by the probability that the listing is materially attractive after edition identity, condition, shipping, and comparable evidence are accounted for.

Trade Me is a concrete NZ source. Its public LP category currently exposes a large inventory and active listings across NZ. Examples visible in the current scan include high-value limited/exclusive records alongside low-priced auction listings. These are signals, not proof of completed sales.

## Target input

- artist
- title
- release/year
- country/pressing
- catalogue number
- barcode
- label
- matrix/runout if known
- preferred condition
- maximum all-in NZD
- acceptable variants
- hard exclusions
- urgency

## Candidate record

Each candidate must preserve:

- source
- listing URL
- seller
- observed timestamp
- title as listed
- asking price
- shipping
- all-in price
- edition identity confidence
- condition
- comparable evidence
- stale status
- ranking reasons
- evidence references

## Ranking

exact release match -> edition rarity -> all-in price -> condition -> comparables -> seller quality -> time sensitivity

No single asking price is treated as market value.

## Truth boundary

A listing is not a sale.

A price is not savings.

A candidate is not arbitrage.

A purchase only becomes an external economic event when the buyer actually completes it and independent evidence supports the event.

## Product ladder

Free: one or two discovered candidates.

NZ$19: ranked Holy Grail shortlist.

NZ$39: monitored watchlist.

NZ$79: deeper collection-gap / sourcing report.

Higher-priced sourcing is only introduced after real delivery time and buyer willingness to pay are measured.

## First implementation

1. Accept target JSON.
2. Search permitted public marketplace surfaces.
3. Normalize candidate listings.
4. Match edition identity.
5. Calculate all-in price.
6. Attach evidence.
7. Rank candidates.
8. Generate a compact report.
9. Preserve the report as a non-revenue discovery artifact.
10. Ask for explicit human approval before any purchase or seller contact.

## Expansion

Once a real user confirms a useful find, reuse the same engine for collection gap hunting, dealer inventory, estate lots, bulk collections, sell-side underpricing, NZ/import comparison, and other collectible categories.

The engine follows intent to pay, not a fixed product category.
