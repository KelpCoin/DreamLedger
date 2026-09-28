# SUBSTRATE ECONOMIC SURVIVAL GATE v1

Status: IMPLEMENTATION-READY
Purpose: convert substrate awareness into an opportunity admission test without creating a macro dashboard or second economic ledger.

## Core rule

A substrate condition is not merely something to monitor.

Before an opportunity is admitted to expensive execution, the runtime must establish whether the opportunity remains economically executable if its material dependencies behave within the observed operating envelope.

`OPPORTUNITY -> DEPENDENCY MAP -> OBSERVED BASELINE -> FAILURE MODE -> ALTERNATIVE -> SURVIVAL -> ADMISSION`

The gate does not create revenue truth and does not authorize payment or fulfillment.

## 1. Admission states

Each live opportunity receives one substrate admission state:

- `UNASSESSED`
- `SURVIVES`
- `SURVIVES_WITH_REPRICE`
- `SURVIVES_WITH_REROUTE`
- `BLOCKED_BY_SUBSTRATE`
- `HUMAN_REVIEW_REQUIRED`
- `EXPIRED_REASSESSMENT`

These are opportunity-control states, not economic outcomes.

## 2. Dependency budget

For each opportunity, calculate the smallest dependency cut set using only the actual execution path.

Required fields:

`DEPENDENCY_ID`
`FUNCTION`
`OWNER`
`OBSERVED_FAILURE_MODE`
`ALTERNATIVE_ID`
`SWITCHING_TIME`
`SWITCHING_COST`
`PERMISSION_STATUS`
`LAST_VERIFIED`

A dependency is material when its failure either:

1. stops fulfillment;
2. prevents settlement;
3. invalidates required evidence;
4. crosses an authority boundary;
5. pushes contribution below the opportunity's explicit economic floor.

No universal risk score is permitted.

## 3. Compute admission

The runtime must distinguish:

`SEARCH_COST`
`PREPARATION_COST`
`FULFILLMENT_COMPUTE_COST`
`RETRY_COST`
`RECOVERY_COST`

This prevents cheap discovery from hiding an expensive fulfillment path.

For each trace lineage:

`TOTAL_AGENT_COST = KNOWN_PROVIDER_COST + KNOWN_LOCAL_COMPUTE_COST + KNOWN_RETRY_COST`

If any required cost is unknown:

`CONTRIBUTION = UNKNOWN`

until the missing observation is resolved.

Unknown is not zero.

## 4. Search-to-opportunity economics

Do not use the word CAC unless an external transaction establishes a valid acquisition denominator.

Instead record:

`SEARCH_TRACE_COUNT`
`TOTAL_SEARCH_COST`
`VIABLE_OPPORTUNITIES_FOUND`
`SEARCH_COST_PER_VIABLE_OPPORTUNITY`

A search process that repeatedly produces zero viable opportunities becomes an observed demand/process failure, not evidence that more architecture is needed.

## 5. Failure-domain isolation

A single failure must not poison unrelated opportunities.

Example:

`MODEL_PROVIDER_A` outage

must not globally pause opportunities that:

- use provider B;
- have a verified non-model execution route;
- or have already reached an external fulfillment stage independent of provider A.

Conversely, a shared dependency must propagate only to opportunities actually bound to it.

This creates a dependency-scoped circuit breaker rather than a global panic switch.

## 6. Circuit-breaker semantics

For each dependency:

`CLOSED` = operating normally.

`DEGRADED` = observed failure or material deterioration, but verified alternative exists.

`OPEN` = continuation would cross a known safety/economic boundary.

`HALF_OPEN` = a bounded recovery probe is permitted.

Recovery probes must be:

- reversible;
- bounded;
- non-financial unless separately authorized;
- incapable of manufacturing economic truth.

A dependency returns to CLOSED only after fresh evidence.

## 7. Chokepoint measurement

Do not label a provider a chokepoint from market concentration research alone.

The runtime must demonstrate:

`FAILURE -> OPPORTUNITY BLOCK`

and:

`NO_IMMEDIATE_VALID_ALTERNATIVE`

Only then does the opportunity carry:

`CHOKEPOINT = TRUE`

The same provider may be a chokepoint for one opportunity and merely optional for another.

## 8. Agent-buyer gate

For `BUYER_CLASS=AGENT`, admission requires separate evidence for:

`IDENTITY`
`AUTHORITY`
`PRINCIPAL`
`SETTLEMENT`
`FULFILLMENT_RECIPIENT`

Until those exist:

`AGENT_DEMAND = UNVERIFIED`

Agent interest can therefore accelerate investigation, but cannot accelerate economic truth.

## 9. Liability gate

Insurance is checked only when a real transaction makes it material.

If:

`INSURANCE_REQUIRED = TRUE`

and:

`COVERAGE = UNAVAILABLE`

and uninsured exposure is material:

`ADMISSION = HUMAN_REVIEW_REQUIRED`

Do not purchase insurance merely to satisfy the framework.

## 10. Reputation portability gate

Internal history may alter routing.

It may not be presented externally as reputation unless the counterparty can verify the identity binding and evidence.

Minimum external recognition record:

`IDENTITY`
`REPUTATION_NAMESPACE`
`VERIFICATION_METHOD`
`COUNTERPARTY_RECOGNITION`
`LAST_VERIFIED`

If the market does not recognize the reputation, treat it as internal state.

## 11. Fiscal gate

Current tax treatment is a live fact.

Future taxation is a watch condition.

The gate therefore accepts:

`CURRENT_RULE`
`JURISDICTION`
`TAX_BASIS`
`FILING_OBLIGATION`
`REVIEW_DATE`

Speculative future tax mechanisms cannot reduce current contribution.

They may trigger:

`FISCAL_RECHECK_REQUESTED`

## 12. Macro research firewall

Macro research can change the frequency or scope of reassessment.

It cannot directly:

- create a buyer;
- invalidate a settled payment;
- create revenue;
- create a dependency;
- establish insurance requirements;
- establish tax liability;
- establish a security compromise.

The bridge remains:

`SOURCE -> OBSERVATION -> APPLICABILITY -> MATERIALITY -> SURVIVAL -> ACTION`

## 13. Reassessment triggers

Reassess an opportunity when one of these occurs:

- actual dependency failure;
- measured compute cost change;
- provider pricing or contract change;
- settlement rail change;
- platform permission change;
- buyer class changes;
- fulfillment channel changes;
- security anomaly;
- insurance requirement appears;
- applicable tax rule changes;
- evidence source becomes stale.

Do not reassess merely because an unrelated macro headline appears.

## 14. Economic floor

Each opportunity must have an explicit floor before heavy execution:

`MINIMUM_ACCEPTABLE_CONTRIBUTION`

The floor may be:

- monetary;
- time-adjusted;
- risk-adjusted;
- or a documented strategic exception.

If the required floor cannot be computed because material costs are unknown, admission is:

`EXPIRED_REASSESSMENT`

rather than optimistic continuation.

## 15. Existing-runtime integration

No new economic ledger.

Attach admission state to existing opportunity/action metadata and existing execution packet context.

The first implementation should consume the existing compute trace and dependency observations.

Only repeated inability to query or enforce these fields justifies schema expansion.

## 16. First implementation target

The first real implementation is deliberately narrow:

`ECONOMIC_ACTION`
→ `ECONOMIC_TRACE_ID`
→ `DEPENDENCY_OBSERVATIONS`
→ `SURVIVAL`
→ `ADMISSION`

The known `HTTP 502 / WORKER_RESOURCE_LIMIT` incident becomes the first regression fixture.

Expected result:

`WORKER_RESOURCE_LIMIT`
+
`NO_VERIFIED_ALTERNATIVE`
→ `BLOCKED_BY_SUBSTRATE`

If a verified alternate worker path exists:

`WORKER_RESOURCE_LIMIT`
+
`VALID_ALTERNATIVE`
→ `SURVIVES_WITH_REROUTE`

If the worker recovers:

`HALF_OPEN`
→ fresh evidence
→ `CLOSED`

## 17. Acceptance tests

1. One provider failure blocks only dependent opportunities.
2. A verified alternative produces REROUTE rather than global PAUSE.
3. Unknown compute cost prevents false positive contribution.
4. Search cost is separated from fulfillment cost.
5. A dependency becomes a chokepoint only after observed path-level blockage.
6. Agent interest cannot create demand truth.
7. Insurance requirements route only when transaction-specific and material.
8. Internal reputation cannot be exported as external reputation.
9. Future tax speculation cannot create current liability.
10. Macro research cannot mutate economic truth.
11. Recovery requires fresh evidence.
12. An opportunity with no valid substrate path reaches BLOCKED_BY_SUBSTRATE.
13. A failure in one opportunity does not poison unrelated opportunities.
14. The admission state can be reconstructed from existing evidence.
15. No synthetic transaction is created by any gate.

## 18. Stop condition

Once one genuine opportunity has:

- a dependency cut set;
- an observed failure mode;
- a measured or explicitly unknown compute cost;
- a survival/admission result;
- and a reconstructable routing decision,

stop building substrate machinery and return to finding and executing the next legitimate economic opportunity.

The substrate layer is finished enough when it can say:

`THIS OPPORTUNITY CAN SURVIVE THE FAILURE WE ACTUALLY OBSERVED, OR IT CANNOT.`

It does not need to predict the economy.
