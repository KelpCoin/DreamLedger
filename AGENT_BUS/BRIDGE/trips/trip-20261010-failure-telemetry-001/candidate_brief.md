# Candidate Economic Discovery Brief — Monetise Failure (Telemetry of Repeated Attempts)
Trip ID: trip-20261010-failure-telemetry-001
Scope: non-MTG, digital/AI-adjacent, local-first. No external spend or publishing.

## Customer
Operators running iterative generative loops (ComfyUI, local LLMs, image pipelines, agent trials) who currently throw away failed runs and lose the learning signal.

## Painful job-to-be-done
Every failed generation, rejected photo, or blocked agent step is discarded. There is no durable, queryable record of *why* it failed, how many times the same pattern repeated, or what finally worked. The cost of exploration is paid repeatedly.

## Proposed deliverable
A lightweight “Failure Telemetry & 777 Persistence Pack”:
- Schema for logging each attempt (input hash, output hash, failure class, retry count, final success flag)
- Simple local collector that writes append-only JSONL or SQLite
- One-page dashboard template that surfaces the most common failure modes and the attempt that finally succeeded
- Optional bridge hook that packages a failure-atlas fossil when the operator chooses to share anonymised patterns

## Existing surface
DreamLedger evidence contract + round-trip receipt already support honest FAIL / BLOCKED / NOT_RUN labels. This pack simply makes repeated failure itself a first-class, compounding asset.

## No-capital acquisition test
- Release the schema + collector as a free GitHub artifact.
- Measure whether any external operator adopts it and later requests a polished hosted version or custom failure-class taxonomy.
- Success signal: at least one external adoption or paid customisation request with independent evidence.

## Fulfilment cost / risk
Near-zero. Static schema + scripts. Optional hosted version can be added later only after demand is observed.

## Success threshold
- Package verifies with scripts/verify_round_trip_artifact.py
- At least one external expression of interest recorded with evidence
- Claimed revenue remains NZ$0 until settled external payment + delivery proof

## Stop condition
If after a defined window there is zero external interest, archive and move to the next candidate.

## 777 framing (operator preference)
The pack treats persistence as a first-class signal: keep the telemetry of every attempt, surface the pattern, and only mark the final successful run. No mystical claims — just durable records of “keep trying until it works.”
