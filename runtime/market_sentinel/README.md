# Market Readiness Sentinel

The Market Readiness Sentinel prevents DreamLedger from confusing architectural readiness with market readiness.

It maintains a private service-role-only state machine:

DORMANT -> WATCHING -> PREPARING -> READY -> DEPLOYABLE -> ACTIVATED -> RETIRED

The sentinel watches externally observed signals such as protocol maturity, real buyer demand, transaction volume, integration availability, settlement availability, policy/legal constraints, implementation readiness, and unit-economic evidence.

It does not automatically publish, deploy, bid, contact buyers, spend money, or authorize external actions.

A capability can be prepared before the market is ready. The sentinel keeps it in PREPARING or READY until the required external trigger arrives. Only then can it become DEPLOYABLE, and deployment remains behind the existing human/authorization gate.

## Economic rule

Build ahead only when the expected value of being ready exceeds the cost and exposure of building it.

Do not activate because a protocol is fashionable.
Do not activate because an internal score is high.
Activate only when external demand is evidenced, the integration path is actually available, the relevant standard or interface is sufficiently stable for the intended use, the implementation is ready, legal/policy constraints are satisfied, the transaction and settlement path are real, and the existing DreamLedger authority gate permits the action.

## Privacy boundary

DreamLedger's GitHub repository is public. Therefore proprietary thresholds, market hypotheses, competitive timing rules, unpublished product strategy, credentials, and private signal histories MUST NOT be stored in the repository.

Those belong in the private sentinel schema in Supabase.

The public repository contains only the generic sentinel contract and code interfaces.

## Current external examples

As of 2026-09-29:
- OpenAI's Agentic Commerce Protocol is publicly documented and currently beta/evolving; Instant Checkout participation is available to approved partners.
- ERC-8183 Agentic Commerce remains Draft.
- VCAP is an active individual IETF Internet-Draft, not an IETF standard.

These facts are signals, not activation commands.

## Non-goals

No fabricated demand.
No synthetic market traction.
No automatic external action.
No autonomous publication of proprietary strategy.
No assumption that a draft protocol will become the winning standard.