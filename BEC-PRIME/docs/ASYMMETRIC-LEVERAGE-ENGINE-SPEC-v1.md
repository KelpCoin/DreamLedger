# BrownEye Cortex - Asymmetric Leverage Engine v1

Status: SPECIFICATION
Purpose: Turn Gauntlet + Elohim + CUBE + LM Studio into a local-first evergreen asset factory.
Primary objective: Maximize verified economic output per unit of Biggie/Peggy attention while preserving truth, silo isolation, approval boundaries and reversible execution.

## 1. Core Outcome

BEC must continuously convert verified signals into candidate economic assets.

The desired loop is:

signal -> opportunity -> supply -> asset candidate -> Gauntlet -> offer -> distribution candidate -> buyer -> payment -> fulfilment -> evidence -> learning -> next asset

The machine should not wait for a human to invent the next product.

Human attention is reserved for:

1. approving external publication when required,
2. approving irreversible spending or commitments,
3. handling exceptional supply/fulfilment cases,
4. changing policy or risk thresholds.

Everything else should be automatable locally.

## 2. What The Existing System Already Provides

### Gauntlet

Gauntlet V6 validates canonical offers, required fields, approval state, checkout state, capability links, provenance and silo contamination. It writes durable proof. It must remain the primary quality and truth gate. Existing implementation: `BEC-PRIME/gauntlet/GauntletV6.js`.

### Leverage Gauntlet

`BEC-PRIME/compiler/LeverageGauntlet.js` validates generated artifacts, including existence, non-trivial size, HTML shell, viewport, game loop where relevant, and obvious-secret detection, then requests an Elohim proposal.

### Elohim

Elohim V6 currently produces deterministic DreamMeez rewards and structured proposals. Its local LM Studio path is optional and is explicitly instructed not to invent payments, customers, credentials or external actions. Existing implementation: `BEC-PRIME/elohim/ElohimV6.js`.

### Revenue Autonomy

`BEC-PRIME/autonomy/RevenueAutonomy.js` already compiles products, runs Gauntlet, runs MacroEngine, queries LM Studio for a next 20-minute atom, invokes Elohim, queues a digital-proxy action, and records payment proof observations. It currently requires three observed paid events before its Rabbit mode becomes ARMED.

### CUBE

CUBE provides the canonical silo registry, economic-event vocabulary, supply verification boundary, offer state and evidence model.

## 3. Missing Capability

The current system can inspect and propose, but it does not yet have a general-purpose autonomous asset production layer.

The missing layer is the Asymmetric Leverage Engine, or ALE.

ALE converts a ranked opportunity into one or more reusable economic assets at near-zero marginal software cost.

Examples:

- diagnostic pages,
- calculators,
- comparison tools,
- checklists,
- templates,
- micro-guides,
- data-backed reports,
- small games,
- niche landing pages,
- seller intake forms,
- buyer qualification tools,
- quote generators,
- inventory finders,
- audit generators,
- bundle builders,
- machine-readable catalog records,
- agent-readable commerce manifests,
- reusable fulfilment packs.

An asset is not revenue. An asset becomes an economic object only when it is attached to verified supply, a legitimate offer, a buyer path, and settlement evidence.

## 4. Asset Factory Architecture

ALE consists of eight stages.

### Stage A - Signal Intake

Sources may include:

- CUBE economic event catalogue,
- Airtable economic opportunities,
- verified site analytics,
- buyer questions,
- failed checkout observations,
- existing inventory,
- seller supply submissions,
- payment outcomes,
- fulfilment outcomes,
- local research files,
- LM Studio-generated opportunity hypotheses.

Every signal receives a deterministic `signal_id` and source record.

### Stage B - Opportunity Scoring

Each opportunity is scored on:

- verified demand evidence,
- supply availability,
- buyer clarity,
- price potential,
- time to first payment,
- fulfilment simplicity,
- gross margin potential,
- repeatability,
- asset reuse potential,
- distribution difficulty,
- trust risk,
- silo fit,
- evidence cost.

Suggested score:

`ALE_SCORE = demand * supply * buyer_clarity * payment_speed * repeatability * margin * reuse / friction`

All factors are normalized to 0..1.

The score is a decision aid, not permission to fabricate.

### Stage C - Asset Synthesis

Elohim + LM Studio produce a structured candidate asset specification.

The candidate must include:

- asset_id,
- silo_id,
- opportunity_id,
- asset_type,
- buyer,
- problem,
- promise,
- inputs,
- outputs,
- price hypothesis,
- supply requirement,
- fulfilment method,
- evidence requirement,
- distribution candidates,
- reuse instructions,
- expected time to payment,
- risk notes.

LM Studio output is advisory. It may suggest, rank and generate candidate material, but it may not claim that an unverified event happened.

### Stage D - Deterministic Compilation

The candidate is compiled into real assets.

Preferred output families:

- HTML/CSS/JS public page,
- JSON product record,
- JSON offer record,
- seller intake record,
- buyer intake record,
- fulfilment checklist,
- proof schema,
- machine-readable metadata.

Compilation must be deterministic and repeatable.

Same input + same policy version must produce the same structural output.

### Stage E - Gauntlet

Every candidate passes two gates.

1. Commercial Gauntlet:
   - canonical fields present,
   - valid capability,
   - silo isolation,
   - supply truth,
   - pricing truth,
   - approval state,
   - provenance,
   - fulfilment path,
   - evidence path.

2. Artifact Leverage Gauntlet:
   - renders correctly,
   - non-trivial asset,
   - no obvious secrets,
   - no forbidden silo leakage,
   - useful buyer path,
   - deterministic output,
   - no broken external references where prohibited.

Failure means QUARANTINE, never auto-publish.

## 5. Asset States

Every asset must have exactly one state:

DISCOVERED
CANDIDATE
COMPILED
GAUNTLET_PASS
SUPPLY_REQUIRED
READY_FOR_APPROVAL
READY_TO_SELL
LIVE
BUYER_INTENT
PAID
FULFILMENT_PENDING
FULFILLED
EVIDENCE_COMPLETE
WINNER
CLONE_CANDIDATE
QUARANTINED
RETIRED

State transitions are append-only events.

No process may jump directly from CANDIDATE to PAID, FULFILLED or WINNER.

## 6. The Asymmetric Leverage Rule

The system should prefer assets that can be created once and reused many times.

Preferred assets have:

- negligible marginal generation cost,
- multiple buyer applications,
- multiple price points,
- multiple silo-compatible variants where allowed,
- machine-readable structure,
- SEO/discovery longevity,
- repeatable fulfilment,
- measurable conversion,
- low support burden.

Example:

One diagnostic engine may produce:

`tool -> report -> template -> paid audit -> implementation offer -> recurring service`

This is the leverage ladder.

## 7. Evergreen Asset Principle

The target is not infinite content.

The target is an evergreen portfolio of reusable economic primitives.

Each asset should answer:

1. Does it solve a persistent problem?
2. Can the same engine produce variants cheaply?
3. Can it accept structured inputs?
4. Can it return a tangible output?
5. Can a buyer pay for the output?
6. Can fulfilment be standardized?
7. Can evidence be captured automatically?
8. Can the result improve the next generation?

Assets that fail these tests should decay, be quarantined or be retired.

## 8. Elohim Operating Contract

Elohim becomes the internal proposal and synthesis intelligence layer.

Allowed autonomously:

- generate candidate ideas,
- generate draft assets,
- generate metadata,
- generate variants,
- generate tests,
- rank alternatives,
- explain Gauntlet failures,
- propose repricing,
- propose next actions,
- identify reusable components,
- generate fulfilment/checklist drafts,
- produce proof candidates.

Not allowed autonomously:

- fabricate sales,
- fabricate customers,
- fabricate inventory,
- invent payment confirmations,
- expose secrets,
- publish prohibited material,
- bypass a human approval gate,
- spend money,
- create legal commitments,
- message people externally without policy authorization.

## 9. Gauntlet Operating Contract

Gauntlet becomes a continuous selection mechanism rather than a final checklist.

For every candidate, output:

- verdict,
- failure reasons,
- economic score,
- trust score,
- evidence score,
- leverage score,
- reuse score,
- suggested next state.

Suggested verdicts:

SELLABLE
PRE-MONEY
SUPPLY_REQUIRED
REWORK
QUARANTINE
DEAD

A failed candidate must be useful as training data for the next candidate.

## 10. Learning Loop

Every completed economic event updates the portfolio.

Record:

- asset_id,
- opportunity_id,
- channel,
- impressions where available,
- clicks,
- buyer actions,
- checkout starts,
- payments,
- gross revenue,
- fees,
- fulfilment cost,
- time to fulfilment,
- refund/cancellation,
- support burden,
- evidence completeness,
- repeat purchase where observed.

Primary learning metrics:

- time_to_first_payment,
- revenue_per_asset,
- revenue_per_attention_hour,
- conversion_rate,
- fulfilment_minutes,
- gross_margin,
- repeatability,
- clone_success_rate.

The objective function should increasingly favour assets that create more verified economic output with less human attention.

## 11. Rabbit Mode Reframed

The existing Rabbit threshold may remain as a trust threshold, but Rabbit Mode should not simply mean "more proposals."

When sufficiently proven, Rabbit Mode should mean:

- clone known winners,
- generate adjacent variants,
- update stale assets,
- create localized versions,
- create buyer-specific versions,
- produce structured distribution candidates,
- monitor checkout health,
- monitor fulfilment latency,
- retire failing variants.

Rabbit Mode must still obey the same approval boundaries.

## 12. LM Studio Continuous Mode

When the Windows machine starts and LM Studio is reachable:

1. load or verify the configured local model,
2. run system health checks,
3. load current CUBE registry,
4. load opportunity queue,
5. load paid-event history,
6. load Gauntlet failures,
7. load prior Elohim proposals,
8. run one bounded ALE cycle,
9. compile candidates,
10. Gauntlet them,
11. write proofs,
12. queue only permitted next actions,
13. sleep/backoff,
14. repeat.

LM Studio outage must not corrupt state. The system records `LM_UNAVAILABLE` and continues deterministic non-LLM health work.

## 13. Attention Budget

Biggie and Peggy are treated as a scarce economic resource.

Each candidate receives:

`human_attention_minutes_estimate`

ALE should maximize:

`verified_expected_profit / human_attention_minutes`

A candidate that requires 45 minutes of human work to earn an uncertain NZ$10 should rank below a candidate that requires 3 minutes to earn an uncertain NZ$20, subject to evidence quality and risk.

## 14. Capital Protection

Autonomy must be asymmetrical in effort but conservative in capital.

Allowed by default:

- local computation,
- file generation,
- deterministic compilation,
- internal simulation,
- offline testing,
- non-public drafts,
- proof generation.

Approval required:

- paid API usage beyond configured budget,
- advertising spend,
- paid distribution,
- external messaging,
- irreversible account changes,
- production changes outside the deployment contract.

## 15. Silo Isolation

Every asset must declare a `silo_id`.

The canonical CUBE registry remains authoritative.

The factory may share infrastructure, compilers and economic primitives across silos, but it must not share:

- confidential inventory,
- private customer information,
- adult material,
- silo-specific secrets,
- customer context across forbidden boundaries.

New commercial silos start inventory-empty.

A generated public silo page is allowed to exist without pretending that stock exists.

## 16. Distribution Contract

Distribution is a separate pipeline from asset creation.

Asset factory can generate:

- landing pages,
- machine-readable pages,
- QR targets,
- internal distribution drafts,
- social copy drafts,
- email drafts,
- partner pitch drafts.

External publication stays approval-gated unless an explicit future policy enables autonomous publication for a low-risk channel.

No system component may equate a generated post with buyer demand.

## 17. Economic Event Contract

The canonical economic event remains:

opportunity -> verified supply -> offer -> buyer action -> settled payment -> fulfilment -> evidence -> repeat

Asset creation is upstream of this event.

Only settled payment plus fulfilment/evidence can promote the asset to `WINNER`.

## 18. Self-Improvement

The system may improve itself only through versioned proposals.

Every material policy or compiler change must produce:

- proposal_id,
- reason,
- source evidence,
- expected economic effect,
- risk delta,
- rollback plan,
- verification result.

No self-modifying production code without a versioned Git commit and verification gates.

## 19. Startup Daemon Contract

Target experience:

Power on Windows -> BEC health check -> LM Studio detected -> ALE starts -> candidates are generated -> Gauntlet filters them -> best candidates are compiled -> proofs are written -> approved work waits for human action -> paid outcomes feed the next cycle.

The system should not require Biggie to manually start five scripts.

Recommended future entry point:

`C:\BrownEyeCortex\Run-BEC.ps1`

with idempotent watchdog installation and health logging.

## 20. Proof Contract

Every cycle writes:

`D:\BrownEyeCortex\BEC\proof\ALE-LATEST.json`

and an append-only JSONL cycle log.

Every candidate receives a durable proof containing:

- candidate ID,
- source opportunity,
- source supply evidence,
- compiler version,
- Gauntlet verdict,
- Elohim proposal ID,
- LM Studio model,
- generated artifact hash,
- policy version,
- approval state,
- economic status.

## 21. First Production Milestone

Do not attempt infinite cloning first.

The first milestone is one proven autonomous asset loop:

1. consume one verified opportunity,
2. generate one candidate asset locally,
3. pass Gauntlet,
4. expose a real offer,
5. receive one real payment,
6. fulfil it,
7. capture evidence,
8. feed the result back into ALE,
9. generate two materially different clone candidates,
10. compare them against the original.

Success means the system can produce a second monetization candidate from the first verified economic event without requiring Biggie to invent the idea manually.

## 22. Definition Of Done

ALE v1 is operational when:

- LM Studio can be detected automatically,
- a verified opportunity enters the queue,
- Elohim generates a structured candidate,
- a compiler emits a concrete artifact,
- Gauntlet scores the artifact,
- the candidate receives a deterministic state,
- proof is written to disk,
- human approval is requested only when policy requires it,
- the resulting payment can be mapped back to the candidate,
- fulfilment evidence can be attached,
- the result updates the ranking model,
- the next candidate is generated automatically.

The system is not considered successful merely because it generates lots of assets.

The KPI is verified economic output per unit of human attention.

## 23. Design Principle

Do not build a content factory.

Build a decision-and-asset factory.

Do not optimize for more files.

Optimize for more verified economic events.

Do not make Biggie the worker.

Make Biggie the final authority at the small number of boundaries where human judgment creates disproportionate value.

That is the asymmetric leverage target.
