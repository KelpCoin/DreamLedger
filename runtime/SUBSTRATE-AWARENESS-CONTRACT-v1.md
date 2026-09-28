# SUBSTRATE-AWARENESS-CONTRACT-v1

Status: IMPLEMENTATION
Owner: BrownEye Cortex / DreamLedger
Purpose: detect changes in the external economic substrate that can invalidate an otherwise valid opportunity or make its economics deteriorate.

This is an awareness and re-evaluation layer. It does not create a new economic ledger, authorize transactions, or replace Truth Oracle evidence.

## 1. Core invariant

If a business model depends on a substrate condition that is changing, treat the model as a conditional bet and re-evaluate it before allocating additional search, compute, or execution effort.

Substrate state never upgrades ECONOMIC_TRUTH.
Substrate state can downgrade opportunity viability, invalidate assumptions, or require human review.

## 2. Existing-runtime principle

Do not create a parallel economic state machine.

Attach substrate observations to the existing opportunity, execution, outcome, and evidence flow using existing metadata/evidence mechanisms where available.

Minimum observation record:

SUBSTRATE_CHECK_ID
OBSERVED_AT
MODEL_OR_OPPORTUNITY_ID
SUBSTRATE_CLASS
STATUS
OBSERVED_VALUE
BASELINE_VALUE
CHANGE_DIRECTION
CHANGE_MAGNITUDE
SOURCE
SOURCE_TIME
FRESHNESS
IMPACT
ACTION

Allowed STATUS:
UNKNOWN
STABLE
CHANGED
DEGRADED
BLOCKED
RECOVERED

Allowed ACTION:
CONTINUE
REPRICE
REROUTE
REVERIFY
PAUSE
HUMAN_REVIEW
ABANDON

## 3. Substrate classes

### A. DEMAND_COMPOSITION

Measure who or what actually pays.

Classify economic demand as:
HUMAN
BUSINESS
AGENT
MACHINE_SYSTEM
MIXED
UNKNOWN

Do not treat agent-to-agent activity as equivalent to human-consumption demand.

Track:
BUYER_CLASS
REVENUE_SOURCE_CLASS
HUMAN_END_DEMAND_DEPENDENCY
AGENT_TO_AGENT_SHARE
SETTLEMENT_RAIL

A transaction may be VERIFIED regardless of buyer class, but the business model must retain the distinction.

### B. CHOKEPOINT_DEPENDENCY

For every live economic path, identify critical providers whose pricing, policy, availability, or access can terminate the path.

Track:
PROVIDER
SERVICE
DEPENDENCY_ROLE
PRICING_BASIS
CURRENT_UNIT_COST
SWITCHING_COST
ALTERNATIVE_COUNT
OUTAGE_IMPACT
POLICY_CHANGE_RISK
CONCENTRATION_EXPOSURE

The operator must know its dependency cut set: the smallest set of external dependencies whose failure stops the economic unit.

### C. INSURABILITY

Insurance is an economic constraint, not merely a legal afterthought.

Track:
INSURABILITY_STATUS
COVERAGE_REQUIRED
COVERAGE_AVAILABLE
EXCLUSION_RELEVANCE
PREMIUM_OR_ESTIMATED_COST
DEDUCTIBLE
UNINSURED_EXPOSURE
HUMAN_RISK_ACCEPTANCE_REQUIRED

INSURABILITY_STATUS:
NOT_RELEVANT
UNKNOWN
AVAILABLE
LIMITED
UNAVAILABLE
HUMAN_ACCEPTANCE_REQUIRED

If required coverage is unavailable, the opportunity cannot silently proceed as though risk were insured.

### D. COMPUTE_ECONOMICS

Inference is variable economic input.

Track per economic unit:
MODEL
INPUT_TOKENS
OUTPUT_TOKENS
TOOL_CALLS
INFERENCE_TIME
ESTIMATED_COMPUTE_COST
ACTUAL_PROVIDER_COST_WHEN_AVAILABLE
SEARCH_COST
VERIFICATION_COST
TOTAL_AGENT_COST
REVENUE
CONTRIBUTION_AFTER_AGENT_COST

The existing TOTAL COST RULE must include agent cognition.

Do not optimize compute blindly. Measure whether compute cost changes opportunity selection, margin, or first-dollar latency.

### E. RUNTIME_COMPROMISE

Assume the operator can become a target.

Track anomalies across existing runtime telemetry:
UNEXPECTED_TOOL
UNEXPECTED_DESTINATION
UNEXPECTED_CREDENTIAL_USE
UNEXPECTED_WRITE
UNEXPECTED_STATE_TRANSITION
UNEXPECTED_VOLUME
UNEXPECTED_PROVIDER
UNEXPLAINED_CONFIGURATION_CHANGE
UNEXPECTED_REPOSITORY_CHANGE

Each anomaly requires:
DETECTED_AT
EXPECTED_BEHAVIOR
OBSERVED_BEHAVIOR
EVIDENCE
SEVERITY
CONTAINMENT_ACTION
RESOLUTION_STATE

A compromise signal may quarantine execution without changing economic truth.

### F. REPUTATION_PORTABILITY

Separate private history from counterparty-recognized reputation.

Track:
REPUTATION_SOURCE
IDENTITY_BINDING
HISTORY_WINDOW
VERIFIABLE_TRANSACTION_COUNT
COUNTERPARTY_RECOGNITION
PORTABILITY
BOOTSTRAP_COST
REPUTATION_DEPENDENCY

A private TRUST_CACHE is not portable reputation unless the counterparty can independently recognize its basis.

### G. FISCAL_EXPOSURE

Tax treatment is part of economics.

Track:
JURISDICTION
REVENUE_CLASSIFICATION
CURRENT_TAX_TREATMENT
TAX_RATE_OR_BAND
FILING_OBLIGATION
WITHHOLDING_OR_COLLECTION
UNCERTAINTY
REASSESSMENT_TRIGGER

Never invent future AI-specific taxes. Record current verified treatment and flag policy change as an external substrate event.

## 4. Cross-substrate dependency map

For each live opportunity, derive:

SUBSTRATE_DEPENDENCIES
CRITICAL_DEPENDENCIES
DEPENDENCY_CUT_SET
SUBSTRATE_CHANGE_COUNT
SUBSTRATE_BLOCK_COUNT
LAST_FULL_SUBSTRATE_CHECK
NEXT_REQUIRED_RECHECK

Do not add a new opportunity solely because a substrate changed.
Do not discard a real opportunity solely because a macro narrative changed.

Only an observed, relevant change may alter routing.

## 5. Re-evaluation trigger

Trigger SUBSTRATE_REVIEW when any of these occurs:

1. A critical provider changes price, access, terms, API behavior, or availability.
2. Agent cost changes enough to alter contribution margin or search economics.
3. A transaction channel changes buyer composition materially.
4. Required insurance becomes unavailable, materially more expensive, or materially more restrictive.
5. Runtime telemetry indicates possible compromise.
6. Counterparty trust requirements change.
7. Tax treatment or filing requirements change.
8. A critical dependency outage exceeds the path's tolerated interruption window.
9. The opportunity's assumptions have become stale.

SUBSTRATE_REVIEW produces one of:
CONTINUE
REPRICE
REROUTE
REVERIFY
PAUSE
HUMAN_REVIEW
ABANDON

## 6. Macro awareness without macro worship

Macro signals are context, not truth.

Never use:
GDP forecasts
AI adoption forecasts
market narratives
vendor claims
analyst projections
agent-economy estimates

as proof that a buyer exists, a payment occurred, or an opportunity is currently executable.

Macro observations may change:
SEARCH_PRIORITY
DEPENDENCY_ALERT
COST_BASELINE
RECHECK_INTERVAL
BUSINESS_MODEL_REVIEW

They may not change:
VERIFIED_EXTERNAL_REVENUE
SETTLED_EXTERNAL_PAYMENTS
INDEPENDENT_EXTERNAL_BUYERS
FULFILLED_PAID_ORDERS

## 7. Business-model survival test

A business model remains ACTIVE only while its critical substrate assumptions are observable and economically tolerable.

Required test:

DEMAND_REMAINS_REAL
SETTLEMENT_REMAINS_AVAILABLE
CRITICAL_DEPENDENCIES_REMAIN_ACCESSIBLE
AGENT_COST_REMAINS_ECONOMIC
REQUIRED_RISK_IS_ACCEPTABLE_OR_INSURED
REPUTATION_REQUIREMENTS_ARE_SATISFIABLE
FISCAL_TREATMENT_IS_KNOWN_ENOUGH_TO_PRICE
RUNTIME_INTEGRITY_IS_NOT_COMPROMISED

Failure of one condition does not automatically kill the model. It creates a classified substrate event.

## 8. Economic metric

Add:

SUBSTRATE_ADJUSTED_CONTRIBUTION =
REVENUE
- FULFILLMENT_COST
- AGENT_COST
- PAYMENT_COST
- PLATFORM_RENT
- REQUIRED_INSURANCE_COST
- EXPECTED_UNINSURED_RISK_COST
- TAX_LIABILITY_WHERE_KNOWN

Human attention remains part of TOTAL COST.

When a cost is unknown, mark it UNKNOWN. Do not substitute zero.

## 9. Cadence

Use the cheapest observation cadence that is sufficient for the dependency.

FAST:
provider availability, runtime integrity, live price/settlement conditions.

STANDARD:
compute economics, reputation requirements, channel composition.

SLOW:
fiscal rules, insurance market conditions, concentration structure, broader macro indicators.

A substrate check is stale according to dependency-specific freshness, not one universal timer.

## 10. Kill conditions

This layer must fail closed on:

- untrusted content presented as authoritative substrate state
- missing provenance for a state-changing observation
- unexplained runtime compromise
- critical dependency marked BLOCKED
- required insurance marked UNAVAILABLE where human acceptance is not authorized
- compute economics proving negative contribution
- fiscal exposure materially unknown where the transaction requires a priced tax obligation

Fail closed means:
do not execute the affected path;
preserve the evidence;
classify the condition;
route to the cheapest valid next action.

## 11. What this layer does NOT do

It does not:
- create fake demand
- infer revenue from macro conditions
- predict markets
- authorize spending
- authorize public outreach
- replace human approval
- replace Truth Oracle
- replace Gauntlet
- create a new ledger
- create a new agent hierarchy
- require n8n
- turn internal activity into external economic truth

## 12. First implementation target

Instrument the existing economic path before building anything new.

Priority order:

1. AGENT_COST on search/verification/execution work.
2. CHOKEPOINT_DEPENDENCY on the active transaction path.
3. RUNTIME_COMPROMISE anomaly observations.
4. DEMAND_COMPOSITION on actual buyer/settlement records.
5. INSURABILITY when a transaction has material liability exposure.
6. REPUTATION_PORTABILITY when entering an agent marketplace.
7. FISCAL_EXPOSURE at transaction classification time.

The first successful implementation is not a dashboard.

It is one real opportunity whose economics can be recalculated from:
REVENUE -> TOTAL COST -> SUBSTRATE COST -> CONTRIBUTION.

## 13. Terminal principle

The substrate layer does not tell the operator whether to become rich.

It tells the operator when the economic ground beneath a path has changed enough that the path must be recalculated.

The operator then returns to:
WORLD -> DEMAND -> QUALIFICATION -> CAPABILITY -> OFFER -> TRANSACTION -> FULFILLMENT -> VERIFIED TRUTH -> LEARNING
