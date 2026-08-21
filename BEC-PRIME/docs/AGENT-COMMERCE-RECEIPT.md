# DreamLedger Agent Commerce Receipt

DreamLedger's agentic-commerce wedge is an evidence layer, not a payment rail, wallet, marketplace, or settlement authority.

The core object is an Agent Commerce Receipt (ACR). It records the economic boundary of an agent-mediated action so an independent verifier can answer:

- Which principal authorized the agent?
- Which agent and model/runtime executed the action?
- Which policy and delegation applied?
- What offer or product was acted on?
- What economic event was recorded?
- Which payment rail reported the event?
- Which provenance commitments were supplied?
- What did the DreamLedger verification machinery actually verify?

## Non-claims

An ACR does not, by itself, prove that a payment rail settled funds. It records the settlement reference or payment evidence supplied by the integration. DreamLedger must not claim independent settlement truth unless it has independently verified that evidence.

An SHA-256 stamp is an integrity commitment. It is not a digital signature. Production signatures require a real signing key, key rotation policy, public-key publication and verification rules.

## Minimum economic loop

`principal -> delegated agent -> policy decision -> action -> economic event -> evidence receipt -> verification`

## Wedge

The merchant or agent integrates once. DreamLedger can sit above different agent/payment protocols and emit the same evidence object. The initial product can be a hosted verifier plus a small per-event verification fee, followed by merchant and enterprise audit tooling.

## Beachhead MVPs

1. Agentic commerce readiness check with a machine-readable receipt example.
2. ACR verification endpoint for signed or hash-stamped receipts.
3. Merchant integration that emits one ACR per completed agent transaction.
4. Auditor/dispute page that accepts a receipt ID and shows exactly which claims were verified.

## Economic proof rule

A working endpoint is not revenue. Revenue is only PROVEN after an actual paid transaction creates durable payment evidence and the corresponding ACR can be independently retrieved and verified.
