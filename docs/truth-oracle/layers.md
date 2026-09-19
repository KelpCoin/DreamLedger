# Truth Oracle Layers

Think of verification as an onion. Each layer answers a narrower question and inherits the uncertainty of the layer beneath it.

## Layer 0: Claim

What does somebody say happened?

Examples:
- "payment succeeded"
- "billboard was delivered"
- "agent fulfilled the order"

Claims are not evidence.

## Layer 1: Artifact

What persisted?

Examples:
- receipt
- webhook record
- database row
- completion proof
- hash

Artifact existence is stronger than a claim, but artifact provenance still matters.

## Layer 2: External Event

Did an independent system actually observe the event?

Examples:
- Stripe TEST checkout/session
- Stripe webhook
- Supabase row produced by the webhook

This layer closes the gap between a local file and an external event.

## Layer 3: Independent Reconstruction

Can a separate process reconstruct the result from raw persisted state?

The verifier must not simply trust the writer's status or hash.

The verifier reconstructs the payload and computes its own hash.

## Layer 4: Fulfillment

Did the promised deliverable actually exist?

For RA_000001:

checkout
-> webhook
-> order
-> entitlement
-> placement
-> completion proof

All links must be observed.

## Layer 5: Economic Truth

Did an external buyer create a real economic event?

Required:
- external buyer
- settled payment
- correct attribution
- fulfillment
- evidence

Test money does not become revenue.

## Layer 6: Repeatability

Can the same verified process produce another real outcome without relying on hidden manual intervention?

Only after the lower layers are proven.

## The onion rule

Never peel past a missing layer by assertion.

If Layer 2 is missing, Layer 4 cannot be called proven.

If Layer 4 is missing, Layer 5 cannot be called verified.

If Layer 5 is missing, there is no economic winner to scale.

The onion is deliberately boring. That is why it is useful.
