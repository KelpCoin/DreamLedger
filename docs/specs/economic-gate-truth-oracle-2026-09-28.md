# BrownEye Cortex Economic Gate and Truth Oracle Specification

Status: LOCKED INTERNAL SPECIFICATION
Date: 2026-09-28

## Elohim 14-question economic-event gate

Every research-stage candidate must answer:

1. What changes? Identify the concrete measurable event.
2. How frequently does it change? Test recurrence.
3. Who notices? Identify the actual observer and demand surface.
4. Who loses money if they miss it? Establish financial pain.
5. Who already pays to monitor it? Test existing paid demand.
6. Who has authority to purchase? Identify purchasing authority.
7. What source proves the event? Require independent, checkable evidence.
8. What computation turns the event into useful information? Define the actual computation.
9. What is the smallest billable unit? Define a discrete priceable unit.
10. Can fulfilment be automated? Test low-touch repeatability.
11. What independent evidence proves fulfilment? Define non-self-reported fulfilment proof.
12. Can the primitive repeat? Test repeat sales to similar buyers.
13. Can the primitive replicate across entities? Test transferability.
14. What causes rejection? Record explicit failure modes for the rejection taxonomy.

Critical failures, especially questions 4, 5, 6, 9, 10 and 11, normally stop advancement.

Passing the gate does not set a commercial price and does not authorize external action.

Research-stage invariants:
- price_nzd = 0
- external_action_allowed = false
- human_approval_required = true

## Truth Oracle

The Truth Oracle is the final authority for external economic truth.

A fact becomes economic truth only when all four conditions are independently evidenced:

1. An external party actually paid.
2. The payment is correctly attributed to a specific offer, candidate, or silo.
3. Fulfilment occurred.
4. Independent proof of fulfilment exists.

Only then may the system increment:
- verified external revenue
- settled external payments
- independent external buyers
- verified recurring economic outcomes

The following are explicitly not revenue or settlement proof:
- checkout started
- checkout abandoned
- payment link created
- database row written
- test or simulation
- generated asset
- internal event
- model output
- candidate assessment
- intent or interest
- self-reported success without external settlement

Locked rule:

You cannot pay to make reality look better. You can pay to see more of what the Oracle already knows. The underlying truth calculation does not change with access level.

## Authority boundaries

Elohim may propose economic structure but cannot declare commercial truth.

Gauntlet may qualify or reject a research candidate but cannot invent demand or turn research qualification into live commerce.

CUBE may move candidates through permitted internal steps but cannot publish, spend, perform outreach, or cross the human external-action gate.

Model workers and assessments produce evidence for later use. They never count as settlement.

Commerce rails can accept or observe real payments. Only the Truth Oracle decides whether those payments become verified revenue.

Human approval is required for external action and remains subordinate to the Truth Oracle for truth claims.

## Locked operating sequence

NOISE / SIGNAL
-> ELOHIM
-> GAUNTLET
-> CUBE PERMITTED INTERNAL STEP
-> HUMAN APPROVAL
-> POSSIBLE EXTERNAL ACTION
-> TRUTH ORACLE

No component may bypass the Truth Oracle.

## Current ground truth

verified_external_revenue_nzd = 0
settled_external_payments = 0
independent_external_buyers = 0
economic_candidate_assessments = 0

The assessment count is telemetry, not revenue. Assessment rows must be produced by genuine worker execution with provenance. They must never be fabricated to advance counters.

## Current engineering blocker

MODEL WORKER EXECUTION.

Required proof:
4 leased tasks
-> 4 genuine model outputs
-> 4 provenance-carrying economic_candidate_assessments rows
-> Gauntlet qualification decision

No synthetic assessment rows are permitted.
No public silos, offers, prices, outreach, spend, or external commerce activation are authorized by this specification.
