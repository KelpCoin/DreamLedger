# EDH One-Link Cinema Pipeline

## Goal

Turn a saved ManaBox deck link into a nearly hands-off DreamLedger MTG catalogue product.

Biggie provides one public deck URL. The pipeline imports the deck, validates the list, benchmarks it against up to five existing DreamLedger decks, generates the primer and media package, creates the optional Monte Carlo Cinema SKU, and publishes the resulting product card to the MTG carousel after automated gates pass.

## User flow

1. Paste ManaBox deck URL.
2. Choose up to five existing carousel decks as comparison targets. If fewer are chosen, use the strongest compatible defaults.
3. Click `Generate Deck Product`.
4. Pipeline returns a job ID immediately and runs asynchronously.
5. Import and normalize commander, cards, quantities, tags, deck metadata and source URL.
6. Validate deck shape before making performance claims.
7. Run Monte Carlo benchmark against each selected comparison deck using a declared engine/version/seed/trial count.
8. Generate a primer from the normalized deck data and benchmark outputs.
9. Generate a product hero image from the deck/card identity.
10. Optionally generate a short hero video and/or animation. Media generation failure must not invalidate the deck listing.
11. Create the Monte Carlo Cinema SKU as a separate product/upsell when the benchmark package is valid.
12. Assemble the catalogue record and publish it to the MTG carousel only after all required gates pass.
13. Persist the complete generation manifest so the product can be regenerated without re-entering the source URL.

## Required pipeline states

`RECEIVED -> IMPORTED -> NORMALIZED -> VALIDATED -> BENCHMARKED -> PRIMERED -> MEDIA_READY -> CATALOGUE_READY -> PUBLISHED`

Failure states:

`IMPORT_FAILED`, `INVALID_DECK`, `BENCHMARK_FAILED`, `PRIMER_FAILED`, `CATALOGUE_FAILED`, `QUARANTINED`

Media is intentionally best-effort:

`MEDIA_PENDING -> MEDIA_READY | MEDIA_SKIPPED`

A media failure must not silently become a fake success.

## API contract

### POST /api/mtg/import

Request:

```json
{
  "source_url": "https://...",
  "comparison_product_ids": ["EDH_0001", "EDH_0002"],
  "generate_video": true,
  "generate_animation": false,
  "create_cinema_sku": true
}
```

Constraints:

- `source_url` must be HTTPS and match an explicitly supported deck-source host.
- Maximum five comparison IDs.
- Comparison IDs must resolve to existing MTG catalogue records.
- No arbitrary remote URL fetching from internal services.
- Do not store payment credentials or secrets in the job payload.

Response:

```json
{
  "job_id": "edh_job_...",
  "status": "RECEIVED"
}
```

### GET /api/mtg/import/:job_id

Returns the current state, errors, generated asset references, benchmark summaries, catalogue product ID, and proof manifest reference.

## Normalized deck record

The importer must persist:

- source URL and source host
- source retrieval timestamp
- source content hash
- commander(s)
- card list and quantities
- total card count
- deck name
- deck tags
- colours/identity
- source metadata used by the primer generator

The original source remains provenance. It is not treated as a claim that DreamLedger owns the source site's content.

## Benchmark contract

The existing deterministic Cinema Monte Carlo engine is explicitly a fixture/narrative engine, not a rules-accurate Magic simulator. The current implementation documents this limitation in its result output.

Therefore the product must label benchmark output as one of:

- `FIXTURE_BENCHMARK`
- `RULES_ACCURATE_BENCHMARK`

Never publish a rules-accurate claim from the fixture engine.

For each comparison:

- deck A ID
- deck B ID
- engine name/version
- seed
- trial count
- turn horizon
- win-rate result
- score/result summary
- caveat text

The UI should surface benchmark results before the long-form primer because the benchmark is the strongest product evidence available from the current engine.

## Primer generation

The primer should be generated from structured deck data plus benchmark evidence, not from an unconstrained prompt alone.

Minimum sections:

1. What the deck does
2. Commander and core plan
3. Key engines and win conditions
4. Early-game priorities
5. Interaction/protection
6. Mulligan guidance
7. Strengths
8. Trade-offs
9. Benchmark snapshot
10. Provenance and simulation caveat

## Media package

Required hero asset:

- product/deck hero image

Optional assets:

- 6-15 second hero video
- short card animation
- card-focused scene sequence

The media generator should receive structured inputs such as commander, colours, deck theme, selected card names and visual style. It must not invent card identities or claim that generated art is official Magic artwork.

Generated media is an enhancement layer. A missing video never blocks publication of a valid deck product.

## Catalogue product

Create one primary MTG product record containing:

- stable product ID
- deck name
- commander
- price/inventory fields
- normalized deck manifest reference
- primer reference
- benchmark reference
- hero image reference
- optional video reference
- optional animation reference
- source provenance
- generation version
- creation timestamp
- publication status

The existing MTG carousel remains the discovery surface. New products should appear there automatically after publication gates pass.

## Monte Carlo Cinema SKU

The Cinema SKU is separate from the physical deck listing.

Suggested relationship:

`PHYSICAL_DECK -> CINEMA_BENCHMARK -> CINEMA_SKU`

The Cinema SKU can sell:

- benchmark report
- deterministic match narrative
- generated cinematic media
- comparison against selected DreamLedger decks

The SKU must clearly distinguish simulation from physical deck ownership and from rules-accurate gameplay evidence.

## Idempotency

The same source URL + normalized source hash + pipeline version must not create duplicate products accidentally.

Use an idempotency key derived from:

`sha256(source_host + source_url + source_content_hash + pipeline_version)`

A rerun should reuse or supersede the existing generation job rather than create a second catalogue product silently.

## Approval boundaries

Automated:

- import
- normalization
- validation
- benchmark
- primer generation
- image/video generation
- catalogue record assembly
- proof generation

Approval-gated:

- public social posting
- paid advertising
- irreversible deletion
- external messages

Publishing a normal catalogue product is automated only when its configured commerce gate permits it.

## Proof manifest

Every completed job writes a machine-readable manifest containing:

- job ID
- source URL/hash
- input comparison IDs
- normalized deck hash
- benchmark engine/version/seed/trials
- primer hash
- media asset hashes
- catalogue product ID
- Cinema SKU ID, if created
- final state
- errors/warnings
- generation timestamps

This manifest is the source of truth for regeneration and debugging.

## First implementation slice

Build in this order:

1. `POST /api/mtg/import`
2. ManaBox URL validation/import adapter
3. normalized deck manifest
4. five-deck comparison selector
5. benchmark job using the existing Monte Carlo engine
6. structured primer generator
7. hero image job
8. optional video job
9. catalogue writer
10. Cinema SKU writer
11. carousel refresh
12. proof manifest + verifier

Do not block the first commercial version on video or animation. The money-making minimum is:

`ONE LINK -> IMPORT -> VALIDATE -> COMPARE -> BENCHMARK -> PRIMER -> HERO IMAGE -> CATALOGUE`

Video/animation then becomes an upsell and enhancement layer rather than a launch dependency.
