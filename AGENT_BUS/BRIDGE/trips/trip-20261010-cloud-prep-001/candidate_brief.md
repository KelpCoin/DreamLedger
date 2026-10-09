# Candidate Economic Discovery Brief (non-MTG)
Trip ID: trip-20261010-cloud-prep-001
Scope: digital / AI-adjacent / local-first tooling only. No MTG content.

## Customer
Independent operators and small teams running local LLMs (LM Studio, Ollama, etc.) who need repeatable, evidence-grade packaging for agent handoffs and offline-to-online reconciliation.

## Painful job-to-be-done
They repeatedly reinvent ad-hoc notes, lose provenance, and cannot prove what an agent actually produced when moving from local machine to GitHub / cloud ledger.

## Proposed deliverable
A single, self-contained Markdown + JSON template pack:
- One-page "Local Agent Handoff Template"
- Matching round_trip_receipt skeleton
- Minimal SHA-256 checklist for package integrity
Delivered as a downloadable .zip or plain files from an existing surface (GitHub release or simple static page already in the ecosystem).

## Existing surface or missing prerequisite
Existing: DreamLedger AGENT_BUS structure, round-trip contract, verify_round_trip_artifact.py.
Missing for sale: a polished, versioned, one-click downloadable pack + a Stripe payment link that maps to it. No new infrastructure required beyond an existing /buy/ style path or a GitHub release asset.

## No-capital acquisition test
- Post the free template once in an existing operator channel or personal network (no paid ads).
- Or add a free GitHub release and measure downloads + inbound questions.
- Success signal: at least one external person requests the paid polished version or pays for a customised instance.

## Attribution
Link or UTM on the free template points back to the paid offer or contact method already controlled by the operator.

## Fulfilment cost / risk
Near-zero. Template is static files. Customisation is optional human time. No inventory, no third-party API spend.

## Success threshold
- Package integrity verified by scripts/verify_round_trip_artifact.py
- At least one external expression of interest or payment intent recorded with independent evidence
- Claimed revenue remains NZ$0 until settled external payment + delivery proof exists

## Stop condition
If after a defined window (e.g. 14 days of free distribution) there is zero external interest, archive the candidate and move to the next non-MTG opportunity.

## Evidence / source references
- AGENT_BUS/BRIDGE/ROUND_TRIP_COMPOUNDING_ARTIFACT_CONTRACT.md
- scripts/verify_round_trip_artifact.py
- Existing local-first and evidence-contract docs in llm-supabase-github-bridge
