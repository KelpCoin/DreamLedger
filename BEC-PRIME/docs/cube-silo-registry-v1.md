# CUBE Silo Registry v1

CUBE provides one commerce spine with isolated worlds. Each silo owns its catalog, fulfillment rules and economic evidence while shared identity and permitted cross-silo discovery remain available.

Canonical silos: mtg, dreammeez, media-music, digital-products, nz-secondhand, b2b.

Invariants:
1. Every listing has a stable silo id.
2. Every sellable item has a stable SKU/item identity.
3. Inventory is never fabricated by the compiler.
4. Cross-silo aggregation preserves source-silo identity.
5. Public external actions remain approval-gated.
6. Payment and fulfillment evidence are required before an event is counted as revenue.
