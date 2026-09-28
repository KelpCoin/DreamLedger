# Reusable data-collection pipeline

Flow: GET source -> parse -> normalize -> provenance -> deduplicate -> change detection -> validation -> CSV/JSON + manifest.

Supports JSON and CSV sources, field mapping, retries with exponential backoff, deterministic record hashes, source provenance, run manifests, validation hooks, and persistent change state.

Retrieval is GET-only. It does not bypass authentication, access controls, CAPTCHAs, robots restrictions, or platform controls. It does not submit forms, contact buyers, make payments, or claim revenue.

Run:
python -m pipelines.data_collection.cli pipelines/data_collection/example.sources.json

For the approximately 200,000-record target, deployment should proceed from representative source -> sample batch -> schema/validation acceptance -> full source expansion. This repository does not claim that 200,000 records have been collected.
