# SUBSTRATE-SURVIVAL-TEST-v1

Status: LIVE DESIGN CONTRACT
Date: 2026-09-29
Parent: SUBSTRATE-AWARENESS-CONTRACT-v1
Purpose: determine whether an economic path remains viable when a dependency changes, without forecasting the macroeconomy.

## Core distinction

SUBSTRATE AWARENESS observes change.

SUBSTRATE SURVIVAL TEST asks whether the opportunity still works after that change.

This is not a macro prediction engine.

It is a counterfactual resilience test over an already identified economic path.

## Required object

Each candidate economic path may carry:

SUBSTRATE_SURVIVAL_ID
ECONOMIC_TRACE_ID
OPPORTUNITY_ID
OBSERVED_AT
DEPENDENCY_CUT_SET
BASELINE_CONTRIBUTION
STRESS_CASE
STRESSED_CONTRIBUTION
DELTA
SUBSTITUTION_AVAILABLE
SWITCHING_COST
SWITCHING_TIME
REPRICE_REQUIRED
CUSTOMER_LOSS_RISK
STATUS
ACTION

## Stress cases

Only apply a stress case when it corresponds to a real dependency.

### PROVIDER_PRICE_UP

Increase the attributable model/provider cost by a bounded test percentage.

Do not claim the provider will make that change.

Purpose: determine whether margin survives rent pressure.

### PROVIDER_OUTAGE

Remove the primary provider from the path.

Measure whether an already available alternative can execute.

No alternative may be invented.

### PROVIDER_POLICY_CHANGE

Mark a required capability as unavailable.

Measure whether the opportunity has another lawful route.

### COMPUTE_CAPACITY_LOSS

Reduce available worker/model capacity to the observed failure boundary.

Purpose: test whether the path survives resource contention.

### BUYER_CLASS_SHIFT

Replace the observed buyer class with another class only when the transaction path explicitly depends on that class.

Do not infer a macro migration from this test.

### INSURANCE_REQUIRED

Add the known required insurance cost or mark the path BLOCKED if the counterparty requires coverage that is unavailable.

Unknown insurance cost remains UNKNOWN.

### FISCAL_RECLASSIFICATION

Apply only a documented current alternative tax treatment.

Do not invent future taxes.

## Survival statuses

SURVIVES
The path remains economically executable and contribution remains above its defined floor.

MARGIN_COMPRESSED
The path remains executable but contribution falls materially.

DEPENDENCY_BREAK
The path cannot execute because a critical dependency is unavailable and no verified alternative exists.

REPRICE_REQUIRED
The path can survive only if price or commercial terms change.

EVIDENCE_REQUIRED
The scenario cannot be assessed because a required current fact is unknown.

NOT_APPLICABLE
The stress case has no causal relationship to the path.

## The important new metric

Define:

SUBSTRATE_OPTIONALITY = number of verified viable alternatives for each dependency cut-set member, weighted by switching cost and switching time.

Do not reduce this to a single score for decision-making.

Store the underlying facts:

ALTERNATIVE_COUNT
LOWEST_SWITCHING_COST
LOWEST_SWITCHING_TIME
CONTRACTUAL_PERMISSION
TECHNICAL_COMPATIBILITY
ECONOMIC_COMPATIBILITY
LAST_VERIFIED

An alternative counts only if it is both technically reachable and contractually permitted.

## Landlord test

For every material external provider:

1. Identify the provider.
2. Identify what part of the economic path disappears if it fails.
3. Identify already-available alternatives.
4. Record switching time and switching cost.
5. Run PROVIDER_PRICE_UP and PROVIDER_OUTAGE.
6. If both tests fail the economics, mark the path DEPENDENCY_BREAK or REPRICE_REQUIRED.

This converts the landlord metaphor into an executable test.

## Agent-demand test

BUYER_CLASS must remain separate from BUYER_VERIFIED.

For any AGENT or MACHINE_SYSTEM candidate:

1. prove the actual counterparty identity;
2. prove the transaction authority;
3. prove settlement;
4. prove fulfillment;
5. measure whether the transaction depends on a human intermediary;
6. measure whether the same service can be purchased by a human/business buyer.

Do not assume agent demand is superior to human demand.

The useful question is:

WHICH COUNTERPARTY CLASS CAN ACTUALLY SETTLE THIS OFFER WITH THE LEAST DEPENDENCY?

## Macro contagion rule

Macro observations may trigger a survival test.

They may not directly trigger a revenue, buyer, or demand claim.

A macro source can produce:

RECHECK_REQUESTED

It cannot produce:

BUYER_FOUND
DEMAND_VERIFIED
REVENUE_VERIFIED
MARKET_CONFIRMED

## Evidence freshness

Each substrate observation gets:

SOURCE
SOURCE_TIME
OBSERVED_TIME
FRESHNESS_WINDOW
CONFIDENCE
INDEPENDENCE_LEVEL

The system must distinguish:

OBSERVED
REPORTED
FORECAST
SCENARIO
UNKNOWN

Forecast and scenario information may affect what is tested, never what is treated as economically true.

## Kill condition

Do not run broad stress testing continuously.

Run a survival test when:

- a material dependency changes;
- observed cost changes materially;
- provider availability changes;
- buyer class changes;
- contractual requirements change;
- insurance becomes relevant;
- tax treatment changes;
- a real execution failure exposes a dependency;
- or a new opportunity depends on a substrate not previously tested.

## Economic priority rule

The substrate layer exists to prevent wasted economic work.

If a candidate fails the survival test because a critical substrate dependency is unavailable or uneconomic, stop spending search/verification effort on that candidate and move to the next viable path.

If it survives, return control to the economic operator.

The substrate layer does not become the operator.

## First implementation

Do not create new database tables.

Represent the first survival-test record inside the existing opportunity/action evidence surfaces.

Run it against the next genuine economic opportunity.

If there is no genuine opportunity:

NO_LIVE_OPPORTUNITY

No synthetic scenario is allowed to create economic progress.

## Definition of done

The system can answer, from recorded evidence:

"If this path loses its most important external dependency, can we still execute it, at what cost, and how quickly can we switch?"

If it cannot answer that, the dependency is UNKNOWN, not resilient.
