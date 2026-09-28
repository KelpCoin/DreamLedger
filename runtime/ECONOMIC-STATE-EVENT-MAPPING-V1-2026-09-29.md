# ECONOMIC STATE -> EVENT MAPPING V1

This layer maps existing persisted state into the canonical economic event vocabulary without creating synthetic economic outcomes.

## Economic actions

Source: public.economic_actions

- action created/prepared -> ACTION_PREPARED
- explicit authorization evidence -> ACTION_AUTHORIZED
- dispatch record -> ACTION_DISPATCHED
- external send evidence -> EXTERNAL_ACTION_SENT
- externally observed result -> EXTERNAL_RESULT_OBSERVED
- blocked/denied action -> ACTION_BLOCKED

Rule: a dispatch row alone cannot become EXTERNAL_ACTION_SENT.

## Execution packets

Source: public.economic_execution_packets

The dispatch_state field is authoritative for dispatch semantics:

- NOT_DISPATCHED -> no action event
- INTERNAL_ROUTED -> ACTION_DISPATCHED with internal routing semantics
- EXTERNAL_BLOCKED -> ACTION_BLOCKED
- EXTERNAL_SENT -> EXTERNAL_ACTION_SENT
- EXTERNAL_RESULT_OBSERVED -> EXTERNAL_RESULT_OBSERVED
- UNKNOWN -> dependency/state ambiguity requiring review

Authorization fields remain separate from dispatch state. authorization_verdict=allow does not itself prove external execution.

## Economic outcomes

Source: public.economic_outcomes

An outcome record is not automatically verified revenue.

A candidate outcome may emit VERDICT_ISSUED when a documented verdict exists, EVIDENCE_CAPTURED when supporting evidence exists, and ECONOMIC_OUTCOME_VERIFIED only when the complete verification predicate passes.

Current truth baseline remains zero verified economic outcomes unless persisted evidence independently proves otherwise.

## Stripe observation boundary

Stripe observations must be classified before entering the economic event stream.

- checkout created -> CHECKOUT_STARTED
- payment attempt -> PAYMENT_ATTEMPTED
- payment failed -> PAYMENT_FAILED
- settled payment with attributable external buyer -> PAYMENT_SETTLED + BUYER_ATTRIBUTED

A PaymentIntent, checkout session, balance entry, or internal reconciliation row must not be promoted to verified revenue merely because it exists.

## Fulfillment and evidence boundary

Fulfillment states:
FULFILLMENT_STARTED, FULFILLMENT_COMPLETED, DELIVERY_RECORDED, BUYER_ACKNOWLEDGED, DISPUTE_OPENED, DISPUTE_RESOLVED.

Evidence states:
EVIDENCE_CAPTURED, VERIFICATION_PASSED, VERIFICATION_FAILED, CONTRADICTION_FOUND.

Final economic verification requires:
independent external buyer + attributable settled payment + fulfillment + evidence + verification.

## Dependency substrate

These are operational evidence, not economic outcomes:
- Render deployment/health
- GitHub CI
- Dapr workflow execution
- MCP invocation
- RAG retrieval
- local machine availability
- capability registration

They can produce dependency and execution events explaining why an economic transition did or did not occur.

## Unknown-state rule

Missing or inaccessible source data becomes UNKNOWN or UNOBSERVABLE. It must not be converted into success, failure, revenue, buyer attribution, or fulfillment.

## Next implementation seam

Implement a read-only event projection first:

persisted state -> deterministic mapper -> canonical event candidate -> predicate evaluation -> next-state recommendation

Only after that projection is independently verified should it gain authority to drive a state transition.

This preserves the distinction between OBSERVATION, EVENT, PREDICATE, TRANSITION, and ECONOMIC TRUTH.
