# SUBSTRATE AWARENESS RUNTIME CONTRACT v1

Status: IMPLEMENTATION-READY
Purpose: turn substrate observations into bounded economic re-evaluation without allowing macro research to become economic truth.

## 1. Boundary

Substrate Awareness is an advisory control plane between external substrate observations and the existing economic decision machinery.

It does not:
- create revenue truth
- create buyer truth
- authorize transactions
- replace the Truth Oracle
- create a parallel economic ledger
- continuously forecast macroeconomic conditions
- manufacture progress from simulations

Its only authority is to say:

`CONTINUE | REPRICE | REROUTE | REVERIFY | PAUSE | HUMAN_REVIEW | ABANDON`

The existing economic authorization and truth layers remain authoritative.

The causal path is:

`SOURCE -> OBSERVATION -> APPLICABILITY -> MATERIALITY -> SURVIVAL -> ECONOMIC_EFFECT -> ACTION`

Never:

`SOURCE -> ECONOMIC_TRUTH`

## 2. Runtime object

For every material substrate observation, the runtime should be able to emit one compact record:

```json
{
  "substrate_check_id": "SC-...",
  "economic_trace_id": "ET-...",
  "opportunity_id": "OP-...",
  "action_id": "EA-...",
  "observed_at": "2026-09-29T00:00:00Z",
  "substrate_class": "COMPUTE_ECONOMICS",
  "source_class": "AUTHORITATIVE_RUNTIME",
  "source_id": "runtime-observation",
  "source_time": "2026-09-29T00:00:00Z",
  "freshness": "FAST",
  "observed_value": {},
  "baseline_value": {},
  "change_direction": "DEGRADED",
  "change_magnitude": "MATERIAL",
  "applicability": "DIRECT",
  "materiality": "HIGH",
  "survival_status": "DEPENDENCY_BREAK",
  "economic_effect": "FULFILLMENT_PATH_BLOCKED",
  "action": "REROUTE",
  "confidence": "HIGH"
}
```

The fields are deliberately descriptive. No scalar substrate score is required.

## 3. Materiality gate

A substrate observation is actionable only if at least one of these is true:

1. It changes the reachable set of legitimate transactions.
2. It changes expected contribution after known variable costs.
3. It changes the ability to settle.
4. It changes the ability to fulfill.
5. It changes the evidence required to establish truth.
6. It changes the authority or permission boundary.
7. It exposes a dependency whose failure stops the opportunity.
8. It creates a newly observed security compromise or integrity anomaly.

Otherwise record the observation and do not disturb the economic loop.

This prevents the system from turning every news item into an operational event.

## 4. Applicability gate

External research must pass an applicability test before it can affect an opportunity.

Required checks:

`JURISDICTION`
`TIME_PERIOD`
`BUSINESS_MODEL`
`COUNTERPARTY_CLASS`
`DEPENDENCY`
`TRANSACTION_TYPE`
`RELEVANT_COST`

Applicability values:

- DIRECT: condition demonstrably applies to the live path.
- CONDITIONAL: applies only if a stated condition occurs.
- INDIRECT: useful context but no direct path dependency established.
- NOT_APPLICABLE: no live dependency.
- UNKNOWN: insufficient evidence.

Only DIRECT observations may automatically create an operational recheck. CONDITIONAL observations create a watch condition. INDIRECT observations remain research context.

## 5. Materiality without a score

Do not compress substrate risk into one universal number.

Classify materiality by observable consequence:

LOW:
No current transaction, margin, authority, settlement, fulfillment, or evidence consequence.

MEDIUM:
A known cost, latency, permission, dependency, or evidence requirement may change, but the current path remains viable.

HIGH:
The current path may lose contribution, require repricing, require new verification, or become operationally unavailable.

CRITICAL:
A dependency break, compromise, unlawful condition, unavailable settlement route, or inability to prove external effect prevents safe continuation.

## 6. Hysteresis

The runtime must not oscillate because a metric moves slightly around a boundary.

Use two thresholds:

`ENTER_THRESHOLD`
`EXIT_THRESHOLD`

Example for compute cost:

- enter REPRICE when measured compute contribution deterioration is materially above baseline;
- return to CONTINUE only after measured economics recover below the lower exit threshold for a defined observation window.

The exact thresholds belong to the opportunity's economics, not to a universal substrate constant.

No action should be triggered solely because a headline changes.

## 7. Dependency cut set

Every live opportunity must expose the smallest external dependency set whose simultaneous failure stops the transaction.

Example:

```
OPPORTUNITY
  -> model provider
  -> worker capacity
  -> payment rail
  -> buyer channel
  -> fulfillment channel
  -> evidence source
```

For each dependency record:

`DEPENDENCY_ID`
`OWNER`
`FUNCTION`
`FAILURE_EFFECT`
`ALTERNATIVE_COUNT`
`SWITCHING_COST`
`SWITCHING_TIME`
`LAST_VERIFIED`
`CONTRACTUAL_PERMISSION`

A dependency is a chokepoint only when its failure materially blocks the opportunity and alternatives are not immediately viable.

## 8. Compute substrate: first live implementation

Compute is the first implementation target because a real economic execution path already produced:

`BUILD_EXECUTION_PACKET -> economic-fulfillment-dispatch HTTP 502 -> WORKER_FAILED -> WORKER_RESOURCE_LIMIT`

That event is not a hypothetical stress case.

For every subsequent genuine economic path, capture:

`ECONOMIC_TRACE_ID`
`ACTION_ID`
`OPPORTUNITY_ID`
`MODEL_PROVIDER`
`MODEL`
`STARTED_AT`
`COMPLETED_AT`
`INPUT_TOKENS`
`OUTPUT_TOKENS`
`TOOL_CALL_COUNT`
`ESTIMATED_PROVIDER_COST`
`ACTUAL_PROVIDER_COST`
`COMPUTE_COST_STATUS`
`WORKER_RESOURCE_STATUS`
`DEPENDENCY_CUT_SET`
`RUNTIME_INTEGRITY`

The first acceptance condition is not "the trace exists."

It is:

`REAL_PATH_ACTION -> TRACE -> COST/RESOURCE OBSERVATION -> CONTRIBUTION IMPACT`

The system must be able to answer:

"Did this action consume enough compute or worker capacity to change whether this opportunity is worth executing?"

If it cannot answer that, compute awareness is incomplete.

## 9. Agent-buyer separation

`BUYER_CLASS=AGENT` is a classification, not proof of demand.

For an agent counterparty, separately establish:

`COUNTERPARTY_IDENTITY`
`AUTHORITY_TO_PURCHASE`
`HUMAN_OR_LEGAL_PRINCIPAL`
`SETTLEMENT_IDENTITY`
`FULFILLMENT_RECIPIENT`
`INDEPENDENT_SETTLEMENT_EVIDENCE`

The runtime must preserve the distinction:

`AGENT_INTEREST`
!=
`AGENT_INTENT`
!=
`AGENT_COMMITMENT`
!=
`SETTLED_PAYMENT`

A machine-to-machine transaction counts as economic activity only under the same external-truth requirements as a human transaction.

The macro substrate layer must never promote an agent-buyer candidate into demand truth.

## 10. Chokepoint test

For every material provider:

1. Identify the provider.
2. Identify the exact service rented.
3. Measure current observed cost.
4. Determine whether contractual permission exists for the intended use.
5. Identify technically compatible alternatives.
6. Determine switching time and switching cost.
7. Test whether the opportunity survives provider outage or material repricing.
8. Record the result.

The result is one of:

`OPTIONAL`
`DEPENDENT`
`CHOKEPOINT`
`BLOCKED`

"Chokepoint" is therefore an observed dependency classification, not a market-power opinion.

## 11. Liability and insurance gate

Insurance becomes operationally relevant only when the transaction, counterparty, venue, contract, or jurisdiction requires it, or when uninsured loss is material.

Required facts:

`INSURANCE_REQUIRED`
`POLICY_AVAILABLE`
`AI_EXCLUSION_PRESENT`
`COVERAGE_SCOPE`
`LIMIT`
`DEDUCTIBLE`
`EXCLUSIONS`
`HUMAN_PRINCIPAL_ACCEPTS_UNINSURED_RISK`

If insurance is required and unavailable, the action cannot silently proceed as though coverage exists.

Route:

`REQUIRED + UNINSURED + MATERIAL -> HUMAN_REVIEW`

No insurance assumption may be inferred from generic business insurance.

## 12. Runtime compromise gate

Substrate Awareness must treat integrity anomalies as a different class from ordinary business failure.

Trigger re-evaluation on:

- unexpected external API calls
- unexpected tool invocation
- credential use outside the approved action
- unexplained state mutation
- repository or dependency integrity change
- evidence-chain inconsistency
- authorization/trace mismatch
- unexplained network destination
- unexpected privilege elevation

If compromise cannot be excluded:

`RUNTIME_INTEGRITY=UNKNOWN`

The economic loop must not silently continue into actions requiring the affected authority boundary.

This is a quarantine condition, not an economic loss classification.

## 13. Reputation portability

The runtime must distinguish:

`INTERNAL_TRUST_HISTORY`
from
`COUNTERPARTY_RECOGNIZED_REPUTATION`

A private history can improve internal routing but cannot be represented as external reputation unless the counterparty can independently verify it.

Track:

`REPUTATION_NAMESPACE`
`IDENTITY_BINDING`
`COUNTERPARTY_RECOGNITION`
`VERIFICATION_METHOD`
`PORTABILITY`
`LAST_VERIFIED`

Until external recognition exists, reputation remains an internal operating aid.

## 14. Fiscal exposure

Do not invent future agent taxes.

For a live opportunity record only:

`CURRENT_TAX_TREATMENT`
`JURISDICTION`
`TAX_BASIS`
`KNOWN_RATE_OR_RULE`
`UNCERTAINTY`
`RELEVANT_FILING_OBLIGATION`
`REVIEW_DATE`

Future policy research can create:

`FISCAL_RECHECK_REQUESTED`

It cannot create a hypothetical liability in current economic truth.

## 15. Action routing

The runtime maps evidence to action using the following bounded rules:

`CONTINUE`
Current substrate remains materially compatible.

`REPRICE`
Known variable cost or required risk provision changes contribution.

`REROUTE`
A dependency is degraded but a verified alternative exists.

`REVERIFY`
Evidence, permission, settlement, reputation, or counterparty condition has become stale.

`PAUSE`
A material condition is unresolved and continuation is reversible.

`HUMAN_REVIEW`
The condition crosses a human authority boundary, such as uninsured material liability or a live financial/legal commitment.

`ABANDON`
The live opportunity cannot satisfy substrate requirements within its bounded search budget.

No action is selected from forecast probability alone.

## 16. Survival test integration

The existing Substrate Survival Test becomes the counterfactual layer.

Observed failure and counterfactual stress are separate:

`OBSERVED_FAILURE`
= something actually happened.

`STRESS_CASE`
= what would happen if a defined condition occurred.

Never merge the two.

A stress case can change routing only when it reveals a dependency requirement for a live opportunity. It does not count as an economic event.

## 17. Cadence

Use event-driven checks first.

FAST:
Provider availability, worker capacity, payment rails, credentials, security integrity.

STANDARD:
Platform rules, contract terms, insurance requirements, buyer-channel structure.

SLOW:
Tax rules, macro-financial research, long-horizon market structure.

A slower source cannot overrule a fresher authoritative runtime observation about the current transaction.

## 18. Stop rule

Stop expanding substrate monitoring when:

1. compute traces exist on a genuine economic path;
2. dependency cut sets can be derived from those traces;
3. contribution can be calculated with observed agent/worker cost;
4. a real substrate change can produce a bounded routing action;
5. compromise conditions fail closed;
6. the system can explain which substrate observation changed the decision.

At that point, seek the next external economic effect.

Do not build a macro dashboard merely because macro data exists.

## 19. Acceptance tests

A compliant implementation must demonstrate:

1. A news/research observation cannot create VERIFIED revenue.
2. An indirect macro observation does not interrupt a live path.
3. A direct provider outage triggers REROUTE or PAUSE when applicable.
4. A measured compute-cost increase can change contribution.
5. A measured worker resource failure is recorded against the economic trace.
6. An agent buyer without settlement evidence remains UNVERIFIED.
7. An insurance requirement without coverage routes to HUMAN_REVIEW when material.
8. An integrity anomaly prevents affected privileged execution.
9. Private reputation history is not represented as externally recognized reputation.
10. A hypothetical tax change creates a recheck request, not a current liability.
11. A provider alternative with verified permission can satisfy REROUTE.
12. A substrate stress test cannot create economic progress.
13. A stale substrate observation forces REVERIFY where freshness is material.
14. The same substrate condition does not oscillate actions around a threshold.
15. The runtime can state the exact substrate observation responsible for a routing decision.

## 20. Economic invariant

The substrate layer exists to preserve one distinction:

`THE ECONOMY MAY CHANGE WITHOUT THE LEDGER CHANGING`

A changing substrate is an input to decision-making.

Only an independently evidenced external economic event changes economic truth.

Therefore:

`SUBSTRATE CHANGE -> RE-EVALUATE`

not:

`SUBSTRATE CHANGE -> CLAIM ECONOMIC PROGRESS`

## 21. Implementation order

1. Instrument the next genuine economic path with ECONOMIC_TRACE_ID.
2. Capture actual compute and worker-resource observations.
3. Derive its dependency cut set.
4. Calculate substrate-adjusted contribution.
5. Exercise one real failure/recovery route.
6. Add the minimum routing hook required for that observed failure.
7. Then extend to insurance, reputation, and fiscal checks only when a live opportunity makes each relevant.

This is the substrate layer's completion path. The target is not comprehensive awareness. The target is demonstrated economic resilience on a real path.
