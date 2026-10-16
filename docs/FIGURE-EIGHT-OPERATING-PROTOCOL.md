# Figure Eight Operating Protocol

**Status:** proposed operating contract. Applies to BECK, the tri-LLM Figure Eight, the Gauntlet, and public artifact generation. This is not a claim that every component is already running.

## Figure Eight = Build Loop × Verify Loop

**Build loop:** receive a bounded objective → gather live evidence → design → build or propose one change → run local checks → prepare a complete handoff.

**Crossing point:** append a decision record containing the objective, authorization scope, exact input/source refs, code/model versions, checks run, outcomes, uncertainty, defended limits, and next action. Store concise rationale and evidence refs, not private hidden chain-of-thought.

**Verify loop:** independently inspect the artifact → challenge assumptions → run adversarial and regression tests → compare expected to actual state → PASS, REPAIR, HOLD or KILL → write the correction as a permanent guardrail. The builder does not grade its own work.

Neither loop may convert a generated artifact, green test, healthy endpoint, checkout start, or model assertion into verified revenue. That requires an independent buyer, processor settlement, canonical SKU/silo attribution, fulfillment, delivery evidence, and independent verification, net of reversals.

## Three hard gates

1. **Design gate:** named owner and independent verifier; bounded scope; acceptance criteria; budget and wall-clock deadline; explicit failure exits; approval requirements; rollback or compensation plan.
2. **Implementation gate:** code and tests exist; adversarial cases run; inputs and outputs are schema-checked; tool access is scoped; evidence is persisted; no secrets or economic side effects have leaked into the artifact.
3. **Release gate:** independent review; runtime proof against the intended deployed version; generated public output reconciles to the approved registry; documentation and defended limits are current; required human approval is recorded. A command exit code alone is insufficient.

## Bounded SRE investigation worker

For incidents such as `503 STRIPE_CONFIG_MISSING`, the worker investigates read-only by default. It may inspect secret **names and presence/empty status**, route contracts, deployed version identity, logs, and repository code. It must not read or echo secret values, rotate secrets, deploy, spend, publish, activate checkout, or alter settlement records without the specific authorization.

Budget: at most 15 tool calls and five minutes wall-clock per run. On exhaustion, missing evidence, tool failure, conflicting evidence, or an unapproved write, stop and return HOLD with the missing evidence named.

Required handoff:
- incident ID, error signature, observed UTC time, service/function and deployed SHA;
- source/log references and names-only configuration inventory;
- code-path trace and exact contract fields;
- observed facts separately from hypotheses, counter-evidence, root-cause confidence, and a falsifier;
- smallest proposed repair, deterministic test plan, rollback, and requested approval;
- **defended limits:** what remains unchanged, what is outside scope, why, and what evidence would reopen the decision;
- next owner/action plus one concrete verification command.

The investigator does not pronounce its own diagnosis correct. A separate verifier checks the source references and tests.

## Customer-facing voice checkpoint

Every generated customer-facing artifact passes through `runtime/humanizer/customer-facing-voice-checkpoint-v1.json` and the validator `scripts/validate-customer-facing-artifact.js`.

1. **Transparency:** record origin and model/tool contribution for each section. Disclose AI assistance accurately when material. Never claim a model, data source, computation or independent check that was not actually used.
2. **Operator voice:** preserve a genuine operator-authored judgment or line with its source reference and operator confirmation. Do not manufacture autobiographical details, sensory memories, customer quotes, or testimonials just to make copy sound human.
3. **Truth-preserving editing:** clarity, rhythm and concision may be improved, but material caveats, factual scope, uncertainty and intended sharpness remain intact. Do not rewrite to evade AI detectors or conceal AI assistance.

The checkpoint is a review gate, not an authorship detector or truth oracle. It returns `PASS_TO_HUMAN_REVIEW`, `HOLD`, or `REJECT`; it can never publish, enable checkout, or alter economic truth. An operator-supplied source reference is provenance, not independent proof that every claim is true.

## Zero-budget inference rule

- Use local inference for suitable private inputs and repeatable tasks only while local capacity is actually available.
- Use the currently available free tier of a cloud provider for public research and non-sensitive drafting if its current terms allow it. Confirm model identity, availability, and limits at use time rather than hard-coding vendor-specific promotional claims.
- Paid cloud/API use is disabled by default until explicit approval identifies the budget/funding source. No retry loop may silently incur spend.
- Deterministic checks and external evidence decide economic truth. A local model is an optional worker, not an authority.

## Learning mode and external brain

The system should retain open loops and reduce task-start friction without outsourcing operator judgment.

- `/start`: show one **Must**, up to two **Should**, optional **Could**, and one recovery step. Before evidence arrives, optionally record the operator's prediction, what would falsify it, and the decision rule.
- `/sync`: save only durable decisions, blockers, source refs, and next action.
- `/wrap`: record the unexpected finding, one skill to practice, one safe task to automate next time, and the next action.
- `/setup`: define work lanes: Build, Reading, Open, Parking lot.

Output mode automates repetitive work. Learning mode asks the operator to predict, recall, explain or independently review before showing the worker's answer. These are planning conventions, not medical treatment.

## Defended limits (do not silently relax)

- Test and simulated events never count as live revenue.
- No paid route activates from schema validity alone.
- New silos inherit templates and policy, never supply, credentials, approval, checkout state, orders or revenue.
- Missing heartbeat means OFFLINE_OR_STALE/UNKNOWN, not proof of power-off.
- AI-detector scores are not proof of authorship.
- Customer-facing voice is not permission to invent a life story.
- A repair without independent verification remains a proposal.
- If cloud deployment quota blocks release, do not keep retrying the same exhausted path; record the blocker and select a reviewed alternative hosting/deployment route.

## Current constraints

This branch is a draft PR and has not been deployed. The observed Render event stream shows repeated `pipeline_minutes_exhausted` failures for DreamLedger1; the public website and gateway have also been observed failing deployment for the same reason. CI checks for the current draft also show existing repository drift in MTG condition/render assertions and public storefront assertions. Treat those as live blockers until each is fixed and the relevant check passes; do not merge merely because some individual contracts pass.

Verified external revenue remains **NZ$0.00** until the full independent economic chain is evidenced.
