# Forensic Fulfillment Acceptance v1

Date: 2026-09-29

## Purpose

This is the acceptance contract for DreamLedger economic operators.

It answers one question before a job is accepted as executable:

> Can this job actually be fulfilled, through a legitimate path, with independently verifiable external evidence?

Honest classification is a feature.

Preparation is not fulfillment.
Capability is not access.
Access is not authority.
Authority is not execution.
Execution is not fulfillment.
Fulfillment is not a verified economic outcome.

## Ten independent gates

Every opportunity must be classified gate-by-gate. A failed gate stops acceptance at that frontier. Later gates must not be inferred from earlier passes.

| Gate | Acceptance question | Pass evidence |
|---|---|---|
| G1 Observed Opportunity | Is there a concrete opportunity rather than an abstract idea? | external opportunity reference or equivalent observation |
| G2 Real Demand | Is there evidence that a buyer/customer actually wants the outcome? | buyer/request/listing/order evidence |
| G3 Required Capability | Can the governed system perform the required work? | tested capability binding |
| G4 Required Data | Are the inputs required for execution actually available and usable? | source/data observation with freshness |
| G5 Legitimate Access | Can the required system/data/service be accessed lawfully and technically? | authenticated/authorized access observation |
| G6 Representation / Authority | Is the operator authorized to act for the relevant principal/account? | explicit authority or platform-supported authorization |
| G7 Executable Workflow | Is there a deterministic, replayable execution path? | exact workflow/action specification |
| G8 Validation | Can the proposed output/action be checked before external commitment? | validation result and acceptance criteria |
| G9 Delivery Surface | Is there a legitimate destination through which the customer can receive the result? | verified delivery endpoint |
| G10 External Action | Can the required external action actually occur under the authority and access available? | external dispatch/result observation |

Classification:

- FULLY_FULFILLABLE: G1-G10 pass.
- PARTIALLY_FULFILLABLE: one or more gates pass, but an external/human gate blocks completion.
- NOT_FULFILLABLE: a required gate cannot be satisfied through a legitimate path.
- UNKNOWN: evidence is insufficient. UNKNOWN is not PASS.

## Execution substrate

The substrate is necessary to prove that the machinery can survive execution. It is not proof of customer fulfillment.

ACTION
-> COMPUTE TRACE
-> DEPENDENCY OBSERVATION
-> SURVIVAL
-> ADMISSION
-> LIVE EXECUTION

A successful worker run, HTTP 200, model response, generated document, database write, queue completion, or CI success proves only the corresponding internal/system property unless an external evidence boundary is crossed.

## External truth boundary

The economic truth boundary is:

INTERNAL WORK
-> EXTERNAL ACTION
-> EXTERNAL RESULT
-> CUSTOMER ACCEPTANCE / FULFILLMENT
-> SETTLED PAYMENT
-> INDEPENDENT EVIDENCE
-> VERIFIED ECONOMIC OUTCOME

No earlier state may be promoted into a later state.

## ACNC reference classification

The current ACNC opportunity demonstrates the contract:

- G1 Observed Opportunity: PASS.
- G2 Real Demand: PASS, based on the observed public opportunity.
- G3 Required Capability: PASS, ACNC_RESEARCH_WORKER exists.
- G4 Required Data: PASS, required public source data has been identified.
- G5 Legitimate Access: PASS for the public source data path.
- G6 Representation / Authority: BLOCKED at the Upwork account boundary.
- G7 Executable Workflow: PASS for the prepared fulfillment path.
- G8 Validation: PASS for prepared output checks.
- G9 Delivery Surface: BLOCKED until the authorized Upwork submission/session is available.
- G10 External Action: BLOCKED because the required external submission has not been legitimately dispatched.

Therefore the opportunity is PARTIALLY_FULFILLABLE, not fulfilled.

The prepared packet, internal routing, actuator code, or generated research must never be counted as an external submission or customer result.

## Operator laws

1. Capability does not imply access.
2. Access does not imply authority.
3. Authority does not imply execution.
4. Execution does not imply fulfillment.
5. Fulfillment does not imply a verified economic outcome.
6. Unknown is not zero.
7. Internal evidence cannot self-certify an external result.
8. A human gate is a real state, not an error to hide.
9. External actions require exact action specification, authorization, idempotency, and evidence.
10. Economic truth changes only at the existing governed evidence boundary.

## Required job record

Every accepted economic job must retain:

- opportunity_id
- primitive/capability identifier
- current fulfillment classification
- ten-gate results
- blocker
- fallback
- retry condition
- expiry
- authorization reference
- exact external action
- idempotency key
- delivery surface
- validation evidence
- external evidence reference
- payment boundary
- verification boundary
- human gate and estimated human minutes when applicable

## Relationship to the transaction primitive factory

The fulfillment contract is orthogonal to the 300-primitive registry.

The primitive defines reusable economic work.

The fulfillment acceptance contract determines whether that work can legitimately traverse the external transaction boundary.

Factory:

PAIN -> BUYER -> TRANSACTION -> PRIMITIVE -> INPUT -> PROCESS -> OUTPUT

Acceptance:

OPPORTUNITY -> DEMAND -> CAPABILITY -> DATA -> ACCESS -> AUTHORITY -> WORKFLOW -> VALIDATION -> DELIVERY -> EXTERNAL ACTION

Economic truth:

EXTERNAL RESULT -> FULFILLMENT -> PAYMENT -> EVIDENCE -> VERIFIED OUTCOME

These layers must not be collapsed.

## Canonical economic scoreboard

CI and fulfillment acceptance never change these values without independent external evidence:

VERIFIED_EXTERNAL_REVENUE = NZ$0.00
SETTLED_EXTERNAL_PAYMENTS = 0
INDEPENDENT_EXTERNAL_BUYERS = 0
VERIFIED_ECONOMIC_OUTCOMES = 0

## CI acceptance

The repository CI validator checks:

- all ten gates are present;
- the conservative operator laws are present;
- the external truth boundary is present;
- the ACNC classification remains PARTIALLY_FULFILLABLE;
- no forbidden internal-success equivalence is introduced;
- the canonical scoreboard remains at zero.

CI passing means the repository contract is internally consistent. It does not mean a customer job has been fulfilled and does not alter economic truth.
