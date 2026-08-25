# Billboard scarcity and mobile commerce decision

## Decision

Use real fixed inventory as the scarcity mechanism. Do not manufacture countdown timers or false stock messages.

Canonical Founding Tile: NZ$50, 100x100.

Each market has 100 founding-equivalent 100x100 positions. Markets are isolated: Global, New Zealand, Australia, South Africa, Americas and Europe.

Larger footprints remain scarce: Medium 50, Wide 30, Large 20 and Takeover 1 per market, subject to the physical 1000x1000 canvas capacity.

## UX

The placement catalogue is horizontal and swipe-first on mobile, with scroll snap. It does not auto-rotate. The selected footprint remains the primary choice, followed by one checkout action.

This follows the useful part of current mobile ecommerce research: users need overview and low-friction browsing, while tall or aggressive horizontal components can interfere with vertical scrolling. Baymard's 2026 benchmark reports that 75% of benchmarked mobile ecommerce sites were only mediocre overall, reinforcing that mobile interaction needs deliberate simplification.

## Scarcity

Scarcity is strongest when it corresponds to a real constraint. A 2022 meta-analysis of 131 studies found scarcity effects vary by scarcity type and context. A 2026 Journal of Retailing paper found supply-driven scarcity can backfire when quantities feel unexpectedly artificial, while availability guarantees and credible external explanations mitigate that effect.

Therefore DreamLedger exposes a durable remaining-position count derived from the actual market canvas. It does not claim a sale happened when it did not, and it does not use fake timers.

## Conversion architecture

Visitor -> market -> visible remaining supply -> footprint carousel -> creative upload -> destination -> NZD price -> Stripe -> paid pending review -> human approval -> published tile -> proof.

The first objective remains one external payment. Conversion theory is subordinate to actual buyer evidence.
