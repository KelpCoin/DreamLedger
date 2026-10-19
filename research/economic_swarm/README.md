# Economic Swarm Research

This module runs a bounded public-source discovery pass in GitHub Actions every four hours and on manual dispatch.

## What it does
- Reads selected public RSS feeds and the Hacker News public search API.
- Archives source URLs, timestamps, short excerpts, hashes, and weak lexical lead markers.
- Deduplicates by canonical source URL hash.
- Loads `data/proven-components.json` and proposes pairwise loop marriages only for components explicitly marked VERIFIED with at least one verified external outcome, evidence reference, and success definition.
- Writes `data/latest-report.json` as a proof artifact.

## What it does not do
- Does not claim that a research lead is demand, a buyer, revenue, or causality.
- Does not publish, contact people, create checkouts, spend money, execute code found online, or clone live commercial systems.
- Does not scrape authenticated pages or bypass access controls.
- Does not treat AI-generated hypotheses as evidence.

## First deployment
Merge the pull request, then use Actions -> Economic Swarm Research -> Run workflow. Scheduled runs operate from the default branch, so the workflow must be merged to `main) for its schedule to take effect. The initial source set is deliberately small; expand it only with source-specific rate limits and terms review.

## Verified component registry
Populate `data/proven-components.json` only from independently verified outcomes. Each component must include:
- `id`
- `status`: `VERIFIED`
- `verified_external_outcomes`: integer >= 1
- `evidence_ref`: immutable proof reference
- `success_definition`: explicit, measurable criteria

An empty registry is valid and results in zero marriage proposals. This is intentional.

## Proof
The workflow validates the JSONL archive and report, commits the idempotent archive to its working branch, and uploads `economic-swarm-proof`. A green workflow proves the research job ran, not that a business made money.
