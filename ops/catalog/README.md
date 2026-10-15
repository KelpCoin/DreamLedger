# DreamLedger bulk catalogue factory

## Purpose

This is a streaming catalogue factory for large candidate sets. It supports batches up to 250,000 candidate records per compile run, multiple registered silos, deterministic candidate digests, Gauntlet proof binding, Elohim refinement tracking, and a resumable Stripe Payment Link provisioner.

This does **not** fabricate products from names or keyword lists. Ingested records must include source and demand provenance and a Gauntlet proof for the exact canonical candidate. Records that fail are rejected, not converted into seeds. Gauntlet-passed records that are not fully commercially ready remain product seeds.

## Flow

\`source evidence → candidate → Gauntlet → product seed or product-ready record → silo/commercial gates → Stripe link → settlement → fulfillment → independent receipt\`

Elohim refinement is an iterative quality loop. Recommendations may be attached to a candidate, but accepted changes to the candidate alter its digest. The altered candidate must be rerun through Gauntlet. Elohim cannot self-approve, bypass missing source material, activate a silo, or publish a Stripe link.

## Candidate input (NDJSON)

One JSON object per line:

\`\`\`json
{
  "schema_version": "dreamledger/catalog-candidate/v1",
  "candidate": {
    "sku": "DEV-API-WRAPPER-001",
    "silo": "developer-assets",
    "kind": "digital_product",
    "name": "Documented API wrapper",
    "description": "A bounded, documented API integration package.",
    "source": {"ref": "https://example.invalid/source", "sha256": "<64-hex-source-digest>"},
    "demand": {"buyer_segment": "API developers", "evidence_ref": "research-record-123"},
    "price": null,
    "unit_economics": {"status": "UNVERIFIED"},
    "fulfillment": {"status": "UNVERIFIED"}
  },
  "gauntlet": {
    "status": "PASS",
    "run_id": "gauntlet-run-id",
    "completed_at": "2026-10-15T12:00:00.000Z",
    "candidate_sha256": "<sha256 of canonical candidate object>",
    "checks": [
      {"id":"schema_valid","status":"PASS"},
      {"id":"source_provenance","status":"PASS"},
      {"id":"demand_evidence","status":"PASS"},
      {"id":"silo_boundary","status":"PASS"},
      {"id":"rights_and_privacy","status":"PASS"},
      {"id":"duplicate_sku","status":"PASS"},
      {"id":"truth_boundary","status":"PASS"}
    ]
  },
  "elohim": {"iteration": 0, "candidate_sha256": "<same candidate digest>", "proposals": []},
  "commercial_review": {"status": "PENDING"},
  "checkout": {"live_activation_approved": false}
}
\`\`\`

The example is a schema illustration only, not an actual product or a passed real Gauntlet run. Calculate the candidate digest using \`canonical()\` / \`candidateDigest()\` from \`catalog-factory.mjs\`; do not type a placeholder digest. A forged JSON status is not cryptographic proof. Production operation must consume proof artifacts generated and retained by the governed Gauntlet path.

## Build a catalogue

\`\`\`bash
node ops/catalog/catalog-factory.mjs --input path/to/candidates.ndjson --registry ops/catalog/silos/registry.json --outdir ops/catalog/build --max-records 250000
node --test ops/catalog/catalog-factory.test.mjs
\`\`\`

Outputs are \`products.ndjson\`, \`seeds.ndjson\`, \`rejected.ndjson\`, and \`manifest.json\`. The compiler rejects every occurrence of a duplicate SKU, preventing an arbitrary first-record-wins decision.

A record becomes \`PRODUCT_READY\` only if all seed and product-specific Gauntlet checks pass, source and demand provenance is complete, price and unit economics are valid, fulfillment has a reproducible test digest, the commercial review is approved, the record has explicit live-checkout approval, and the silo is enabled for live checkout. Otherwise a Gauntlet-passed candidate is emitted as \`GAUNTLET_PASSED_SEED\`.

The registered silos are ingest-only shells. No public storefront or live checkout is enabled by default.

## Stripe Payment Links

Stripe Payment Links are live and active immediately when created. The provisioner is dry-run by default and only selects records compiled to \`PRODUCT_READY\`, then independently rechecks the Gauntlet, fulfillment, price, approval, and silo gates.

\`\`\`bash
node ops/catalog/stripe-link-provisioner.mjs --input ops/catalog/build/products.ndjson --limit 25
\`\`\`

The command above does not make Stripe calls. A live batch additionally requires the explicit \`--apply-live\` flag, \`STRIPE_LIVE_ENABLED=true\`, an \`sk_live_\` secret stored only in the operator environment, and \`DREAMLEDGER_STRIPE_LIVE_ACK=I_UNDERSTAND_LIVE_STRIPE_LINKS_ARE_ACTIVE\`. Never paste the secret into chat, source control, logs, or a bridge file. The per-run limit is capped at 250 links. The append-only state file records deterministic idempotency keys and marks ambiguous outcomes \`REVIEW_REQUIRED\`; do not retry ambiguous outcomes blindly.

## Never infer economic truth

Generating a seed, compiling a product, creating a Stripe Product/Price/Payment Link, or seeing an active link is not revenue. The revenue gate remains independent external buyer + settled payment + correct attribution + actual fulfillment + independent delivery evidence.
