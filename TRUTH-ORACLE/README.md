# Truth Oracle

Public-interest reference layer for New Zealand household savings information.

The Oracle is evidence-first. A public claim is never treated as current merely because an editor or model wrote it. Current truth is compiled from dated evidence, with freshness and contradiction state carried into the public surface.

## First vertical slice

1. Claim records live as Markdown under `TRUTH-ORACLE/claims/`.
2. Each claim has machine-readable front matter.
3. Evidence is append-only and hashed.
4. `VERIFIED`, `STALE`, `CONTRADICTED`, and `MISSING` are explicit states.
5. A deterministic compiler emits a static public page.
6. Commercial links are optional and subordinate to the public information.

## Authority rule

Evidence beats prose. A claim may only be `VERIFIED` when it has source evidence, an observation timestamp, geographic scope, a valid freshness window, and no unresolved contradiction.

This directory is intentionally independent of DreamLedger commerce internals. The compiler may publish into the existing `BEC-PRIME/compiled/website` surface, but the evidence record remains the authority.

## Initial domains

- electricity
- groceries
- fuel
- internet
- mobile
- insurance
- household essentials
- subscriptions
- banking fees
- official cost-of-living statistics

The first production domain should be electricity because the source and regional comparison model are already well defined. No retailer ranking is emitted until the underlying evidence is actually ingested and verified.
