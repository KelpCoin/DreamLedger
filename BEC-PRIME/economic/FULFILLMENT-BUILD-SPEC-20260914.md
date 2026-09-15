# B2B EVIDENCE AUDIT FULFILLMENT BUILD SPEC

Status: DRAFT / NON-PRODUCTION

## Objective

Make B2B-EVIDENCE-AUDIT-001 fulfillable from a paid, attributable order to a deterministic evidence artifact without manual computer operation for the normal path.

## Buyer input

- source_url
- claim

## Output

A timestamped Markdown evidence report containing:

1. claim under review
2. source inspected
3. evidence found
4. evidence strength
5. contradiction or uncertainty
6. conclusion
7. verification timestamp
8. artifact SHA-256

## Required state machine

PAID -> FULFILLMENT_REQUESTED -> IN_PROGRESS -> ARTIFACT_READY -> DELIVERED

No state transition may be inferred from checkout creation alone.

## Required gates

- Stripe payment must be settled and attributable to the SKU.
- Buyer inputs must be present and valid.
- Worker lease must be fenced.
- Artifact must be stored under the fulfillment ID.
- SHA-256 must be computed from the stored artifact.
- Completion must verify the artifact hash before marking fulfillment complete.
- Delivery URL must resolve to the authenticated buyer delivery boundary.
- Every completion must leave machine-readable evidence.

## Local-first worker

LM Studio may draft the report from supplied evidence, but externally observable claims require source evidence. The worker must label unknown or unverifiable claims instead of inventing them.

## Production boundary

This file authorizes design and local/draft implementation only. It does not authorize merge, deployment, public copy changes, outreach, payment creation, or financial action.

## Proof required before approval

- deterministic unit tests
- fixture fulfillment with synthetic/non-financial data only
- artifact hash verification
- stale lease rejection
- idempotent completion
- missing-input rejection
- proof JSON containing every state transition
