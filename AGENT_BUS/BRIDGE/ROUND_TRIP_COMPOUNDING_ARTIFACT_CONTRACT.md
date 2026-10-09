# Round-Trip Compounding Artifact Contract

Date: 2026-10-10
Status: First reusable contract component; end-to-end local/cloud execution not yet verified.

## Purpose
A test trip must return a durable artifact that can improve the next trip. The package is both the immediate work result and a source of reusable capability. This contract does not create a queue, ledger, or authority system; it describes the evidence package attached to an existing job.

## Required package
One JSON receipt named `round_trip_receipt.json` must contain:
- `schema_version`: currently `1`.
- `trip_id`: stable identifier for this execution.
- `objective`: concise description of the requested work.
- `origin`: dispatch surface and originating job identifier, if available.
- `worker`: execution environment and model/tool identity, without secrets.
- `status`: `SUCCEEDED`, `FAILED`, or `BLOCKED`.
- `started_at` and `finished_at`: ISO-8601 timestamps with timezone.
- `outputs`: list of relative artifact paths, SHA-256 hashes, and media types.
- `checks`: list of named checks with `PASS`, `FAIL`, or `NOT_RUN`, plus concise evidence.
- `compounding_assets`: list of reusable items produced or updated, such as tested code, a prompt, a repair note, a structured dataset, a benchmark, or a documented capability. Each item identifies its path and why it improves future work.
- `limitations`: unverified assumptions and known failures.
- `external_effect`: must default to `NOT_ATTEMPTED`; use `OBSERVED` only when independent evidence is attached.
- `revenue_claim`: must default to `NONE`; never infer revenue from job completion, generated files, checkout starts, internal rows, or simulated tests.

## Integrity and safety rules
- All output paths must be relative to the package root and must not escape it.
- Hash output bytes with SHA-256 so the cloud side can detect changed or corrupted artifacts.
- Never include credentials, tokens, private keys, or unnecessary personal data.
- A passing local check proves only that check passed in that environment.
- `DISPATCHED` is not equivalent to `EXTERNAL_SENT`; a provider response is not always proof the intended external state persisted.
- Any external action remains subject to the active Gauntlet policy and Digital Proxy authorization. This receipt does not authorize an action.
- Revenue remains unverified until independent evidence reconciles external payment, attribution, fulfillment, and proof.

## The compounding requirement
Every successful trip must either:
1. return at least one reusable asset, with its path and rationale; or
2. explicitly state `NO_REUSABLE_ASSET` in `limitations` and explain why.

Prefer artifacts that reduce repeated work: a regression test, verified fix, reusable prompt, model-routing observation, structured source dataset, or precise failure diagnosis. Do not save raw model chatter as a compounding asset unless it has been evaluated and structured.

## Acceptance test
A trip is package-valid only when the receipt schema is complete, output files exist, hashes match, checks are honestly labelled, and no unsupported external-effect or revenue claim is made. Package validity does not prove the underlying work is correct; the named checks and independent external observations remain separate evidence.

## Status boundary
This contract is committed documentation. The verifier is a component to run in CI/local execution. A real figure-eight trip is not complete until a local worker returns an artifact and receipt, cloud validation verifies it, and the next cycle demonstrably reuses or learns from the returned asset.