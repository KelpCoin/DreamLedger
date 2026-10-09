# Candidate Economic Discovery Brief — Failure Telemetry Pack (Hardened)
Trip ID: trip-20261010-failure-telemetry-001
Version: 1.1 (hardened)
Scope: non-MTG, digital / AI-adjacent, local-first. No external spend or publishing in this package.

## Customer
Operators running iterative generative loops (ComfyUI, local LLMs, image pipelines, agent trials) who currently discard failed runs and lose the learning signal.

## Painful job-to-be-done
Failed generations, rejected outputs, and blocked agent steps are thrown away. There is no durable, queryable record of why something failed, how often the same pattern repeats, or which attempt finally succeeded. Exploration cost is paid repeatedly.

## Proposed deliverable (free core)
A self-contained Failure Telemetry Pack:
- Minimal attempt-record schema
- Append-only local collector (JSONL, pure Python standard library)
- Simple failure-class taxonomy
- One-page usage notes
- Optional later bridge hook to package anonymised failure atlases as fossils

## Existing surface
DreamLedger evidence contract and round-trip receipts already support honest FAIL / BLOCKED / NOT_RUN labels. This pack makes repeated failure itself a first-class, compounding asset.

## No-capital acquisition test
1. Release the pack as a free GitHub artifact (this trip folder or a tagged release).
2. Observe whether any external operator adopts the collector or requests a polished hosted version / custom taxonomy.
3. Success signal: at least one external adoption or paid customisation request backed by independent evidence.

## Fulfilment cost / risk
Near-zero for the free core (static files + one Python script). Hosted or custom versions only after observed demand.

## Success threshold
- Package verifies with scripts/verify_round_trip_artifact.py
- External interest recorded with evidence before any revenue claim
- Claimed revenue remains NZ$0 until settled external payment + delivery proof exists

## Stop condition
If after a defined window there is zero external interest, archive and move to the next candidate.

## 777 / persistence framing
The pack treats persistence as a first-class signal: keep the telemetry of every attempt, surface the pattern, mark the final success. No mystical claims — only durable records.
