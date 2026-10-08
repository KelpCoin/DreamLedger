# 777 Observatory Contracts: Blocks 301–400
Status: DESIGN / UNVERIFIED. These contracts describe data shape, not live market access, regulatory approval, execution authority, or revenue.

## Shared asset envelope

Every published record must use this envelope. A missing required source or unsupported material claim fails publication.

```json
{
  "schema_version": "1.0.0",
  "asset_id": "string: stable namespaced identifier",
  "block": 301,
  "vertical": "aerospace-provenance | carbon-forward | healthcare-cold-chain | customs-discrepancy",
  "title": "string",
  "summary": "string",
  "status": "draft | source-verified | reviewed | published | stale | withdrawn",
  "truth_label": "VERIFIED | UNVERIFIED | CONTRADICTED | STALE | TEST | SIMULATED | INTERNAL",
  "as_of": "ISO-8601 timestamp",
  "jurisdiction": ["string"],
  "entities": [{"entity_id":"string","role":"buyer | supplier | issuer | regulator | carrier | broker | operator","name":"string"}],
  "claims": [{
    "claim_id":"string",
    "text":"string",
    "status":"verified | unverified | contradicted | stale",
    "evidence_ids":["string"],
    "reviewed_at":"ISO-8601 timestamp"
  }],
  "evidence": [{
    "evidence_id":"string",
    "source_type":"primary | regulator | issuer | buyer-provided | secondary",
    "publisher":"string",
    "title":"string",
    "url":"https://...",
    "published_at":"ISO-8601 timestamp or null",
    "retrieved_at":"ISO-8601 timestamp",
    "content_sha256":"64 lowercase hex characters",
    "supports_claim_ids":["string"]
  }],
  "commercial": {
    "problem":"string",
    "affected_party":"string",
    "cost_or_risk_mechanism":"string",
    "buyer_signal":"none | inferred | explicit | verified",
    "offer_id":"string or null",
    "price_minor_units":0,
    "currency":"NZD",
    "fulfillment_mode":"automated | human-gated | unavailable"
  },
  "links": [{"relation":"supports | contradicts | updates | related_to | supersedes","asset_id":"string"}],
  "quality": {
    "source_count":0,
    "primary_source_count":0,
    "unique_attributes":[],
    "word_count":0,
    "duplicate_fingerprint":"sha256",
    "publish_gate":"PASS | HOLD | REJECT",
    "gate_reasons":[]
  }
}
```

## Block 301–325: Aerospace parts provenance

Required domain fields:
- `part_number`, `serial_or_batch`, `manufacturer`, `part_status`, `aircraft_or_engine_context`
- `release_document`: type, issuer, document identifier, issue date, applicable jurisdiction, verification status
- `chain_of_custody[]`: actor, event, timestamp, evidence ID
- `conformity_checks[]`: requirement, result, evidence ID, reviewer
- `disposition`: `unknown | traceable | discrepancy | quarantined`

Hard gate: the service may report missing or inconsistent documentation. It must not certify airworthiness, infer authenticity from a document image alone, or replace the accountable aviation authority/operator. Any safety-critical mismatch is `HOLD`, never an automated clearance.

## Block 326–350: Carbon-credit forward matching

Required domain fields:
- `instrument`: registry, project ID, methodology, vintage, unit type, geography
- `contract`: buyer criteria, volume, delivery window, currency, price basis, settlement terms, counterparty requirements
- `eligibility_rules[]`: rule ID, source URL, effective date, applicability, status
- `match`: eligible volume, unmatched volume, exclusions, confidence, explanation
- `market_observation`: observed value, units, observation time, source, quote type (`indicative | executable | settled`)

Hard gate: never present indicative prices as executable offers or settled transactions. Do not recommend a match unless instrument, registry, vintage, methodology, delivery and counterparty constraints have all been checked. Flag legal, tax, and financial advice boundaries.

## Block 351–375: Healthcare / cold-chain evidence

Required domain fields:
- `shipment_id`, `product_class`, `required_temperature_range`, `sensor_id`, `calibration_status`
- `observations[]`: timestamp, value, unit, sensor, integrity status, evidence ID
- `excursions[]`: start, end, min/max, duration, applicable threshold, disposition
- `custody_events[]`: actor, timestamp, location reference, evidence ID
- `review_status`: `not_reviewed | within_limits | excursion_detected | human_review_required`

Hard gate: preserve raw telemetry and units. Do not declare product safe or unsafe from incomplete telemetry; route excursions and gaps to the responsible qualified reviewer.

## Block 376–400: Customs discrepancy agent

Required domain fields:
- `shipment`: shipment ID, origin, destination, transport mode, declaration ID, declared value and currency
- `lines[]`: line ID, item description, quantity, unit, HS code and code-system version, country of origin, unit value, currency
- `documents[]`: type, issuer, identifier, date, evidence ID, extraction confidence
- `comparisons[]`: field, declared value, observed value, normalization rule, variance, severity, evidence IDs
- `rules[]`: jurisdiction, rule reference, effective date, source URL, applicability result
- `recommendation`: `no_material_discrepancy | request_documents | human_review | hold_for_authorized_review`
- `audit`: input hashes, transformation versions, actor, timestamps, idempotency key

Hard gate: this is discrepancy detection, not customs clearance or legal classification advice. Low-confidence extraction, conflicting documents, sanctions/export-control flags, valuation differences, or HS-code ambiguity must route to authorized human review. Never autonomously amend declarations, submit filings, or release goods.

## Shared publish and execution gates

1. **Provenance:** every material factual claim points to retrievable evidence; retain content hash and retrieval time.
2. **Freshness:** expiring rules, prices, and status fields become `STALE` when their configured review window passes.
3. **Distinct value:** reject duplicate fingerprints, near-duplicate summaries, and pages with no unique verified attributes.
4. **Quality:** word count is a diagnostic, not a substitute for usefulness. Do not pad to hit a word floor. Publish only when the page answers a distinct buyer question with sourced details.
5. **Linking:** link to relevant products, prior assets, conflicting evidence, and primary sources; do not fabricate relationships.
6. **Authority:** research and comparison can run automatically. External actions require scoped authorization, idempotency, limits, and an auditable receipt.
7. **Economic truth:** an offer, click, checkout session, test payment, or internal event is not settled revenue. Revenue advances only after independently observed settlement and fulfillment evidence.
8. **Rollout:** start with a small reviewable cohort; inspect indexation, qualified traffic, corrections, and conversion before expanding. Do not assume that page count creates authority or traffic.

## Minimal validation examples

- Reject: no source URL, malformed content hash, unsupported `VERIFIED` claim, duplicate fingerprint, missing jurisdiction for a jurisdiction-specific rule.
- Hold: source conflicts, stale rules, uncertain extraction, safety/compliance discrepancy, or external action without authority.
- Pass: distinct buyer problem, relevant primary evidence, claims mapped to evidence, freshness checked, domain-specific hard gates passed, and useful next action stated.

## Next acceptance tests

- Valid record passes schema validation.
- Missing primary evidence fails the relevant publish gate.
- Stale or contradictory evidence changes truth status and blocks high-risk recommendations.
- Same idempotency key cannot create duplicate external actions.
- Customs mismatch yields a review recommendation, not an autonomous filing.
- Carbon indicative quote cannot be emitted as executable or settled.
- Aerospace document presence cannot be converted into an airworthiness certification.
- Healthcare telemetry gap cannot be silently treated as an in-range reading.
