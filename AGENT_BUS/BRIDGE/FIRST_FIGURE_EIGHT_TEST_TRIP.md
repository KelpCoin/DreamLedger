# First Figure-Eight Test Trip: Return a Compounding Artifact

Task ID: `trip-20261010-beck-economic-discovery-001`
Owner node: `cloud` until a live LM Studio worker is observed; then `lmstudio` may claim the local stage.
Status: `READY_FOR_CLOUD_PREPARATION`; local execution is pending machine availability.
Scope: non-MTG economic/crypto/digital-product ecosystem only. Do not use Magic: The Gathering data, assets, audience, or product logic.

## Objective
Produce one immediately usable, evidence-backed economic discovery artifact and one reusable component that improves later trips. No external publishing, outreach, account changes, or spending.

## Existing surfaces to reuse
- Canonical repository: `KelpCoin/DreamLedger`.
- Existing dispatch: CUBE / `public.jobs` and Agent Bridge. Do not add a new queue.
- Read `AGENTS.md`, `AGENT_BUS/BRIDGE/PROTOCOL.md`, `AGENT_BUS/MONEY-PLAYBOOK-500.md`, and `AGENT_BUS/BRIDGE/ROUND_TRIP_COMPOUNDING_ARTIFACT_CONTRACT.md` before execution.
- Package verifier: `scripts/verify_round_trip_artifact.py`.

## Work stages
1. Cloud preparation: select one non-MTG digital/AI/crypto-adjacent economic opportunity from existing repository assets or documented evidence. Do not fabricate demand or use unsupported claims. Prefer zero-upfront-cost, deliverable offers.
2. Create an artifact package containing a concrete candidate brief: customer, painful job-to-be-done, proposed deliverable, existing surface or exact missing prerequisite, no-capital acquisition test, attribution, fulfillment cost/risk, success threshold, stop condition, and evidence/source references.
3. Add a reusable improvement: a tested check, structured source dataset, precise repair, model-routing observation, or repeatable prompt that makes a later trip more effective. State why it compounds.
4. Run locally only when an actual LM Studio worker is available. Give it the bounded artifact-research/refinement task and require it to return files plus `round_trip_receipt.json`; no credentials or external side effects.
5. Cloud side verifies file hashes and receipt using `python scripts/verify_round_trip_artifact.py <package-root>`, reviews factual and economic claims, and records failures honestly.
6. Feed the reusable asset into the next existing task/handoff so reuse is demonstrated, not merely promised.

## Acceptance criteria
- At least one concrete usable artifact is returned.
- Receipt lists all outputs and SHA-256 hashes.
- A compounding asset is included, or the reason for `NO_REUSABLE_ASSET` is explicit.
- Tests distinguish PASS, FAIL, and NOT_RUN.
- No external effect is claimed without independent evidence.
- No revenue is claimed without independently verified settled payment, attribution, fulfillment, and delivery proof.
- No MTG content or silo crossover.
- No public action or spending.

## Handoff format
Return: task ID, base commit SHA, files changed, output hashes, exact validation command and result, truth label, limitations, and the next unblocked action.

## Current blocker
The cloud can prepare and validate repository artifacts. The local GPU stage cannot be claimed complete until a real local execution receipt is returned. Keep cloud-only progress moving in the meantime.