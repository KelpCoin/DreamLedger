# Elohim refinement contract v1

Elohim improves candidate quality over time, but refinement is deliberately separated from approval and commerce.

1. Every queue job is bound to one SKU, silo, source references, demand evidence, Gauntlet run ID, and SHA-256 candidate digest.
2. Elohim may propose clearer positioning, missing evidence, added risk checks, stronger fulfillment contracts, pricing experiments, or product retirement recommendations.
3. Elohim must not invent demand, fabricate citations, mark a gate as passed, directly mutate the canonical candidate, approve its own recommendations, enable checkout, or claim revenue.
4. A human or governed workflow may accept a proposal into a new candidate revision. Any change to the canonical candidate changes its SHA-256 digest.
5. The revised candidate must pass the Gauntlet against its new digest before it can remain a product or seed. A previous PASS does not carry forward.
6. A failed or stale candidate is quarantined and cannot receive a Stripe Payment Link.
7. Historical revisions and prior decisions remain append-only. Refinement improves the lineage; it does not rewrite it.

Use \`node ops/catalog/elohim-refinement-queue.mjs\` after compilation. This creates review tasks; it does not claim that an LLM ran or that any product improved until a real Elohim worker records a signed, versioned response.
