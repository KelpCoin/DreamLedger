# B2B-EVIDENCE-AUDIT-001 Fulfillment Contract

STATUS: PRE_RELEASE / IMPLEMENTATION SPEC
SKU: B2B-EVIDENCE-AUDIT-001
PRICE_NZD: 49

## Objective

Turn one settled external purchase into one attributable, reproducible evidence report without requiring manual database edits.

## Required buyer inputs

- source_url: required HTTPS URL or supplied evidence location
- claim: required statement the buyer wants checked
- buyer_email: obtained from the settled checkout/payment record where available
- order_id: canonical commerce order identifier

## Fulfillment state machine

PAID -> IN_PROGRESS -> ARTIFACT_READY -> VERIFIED -> DELIVERED

Failure states:

PAID -> BLOCKED
IN_PROGRESS -> BLOCKED
ARTIFACT_READY -> REJECTED

No delivery may be marked VERIFIED unless all of these exist:

1. canonical paid order reference
2. SKU match
3. buyer attribution
4. source_url and claim
5. artifact bytes
6. SHA-256 of artifact
7. deterministic verification result
8. delivery location/reference

## Artifact contract

The worker must produce a UTF-8 Markdown report with these headings:

# Evidence Audit Report
## Scope
## Claim
## Evidence Reviewed
## Findings
## Risk / Consequence
## Proof
## Remediation
## Verification Method
## Limitations

The artifact must not invent evidence. Missing evidence is reported as UNKNOWN.

## Verification

The verifier recomputes SHA-256 over the exact artifact bytes and checks the fulfillment/order linkage. A mismatched hash, wrong SKU, unpaid order, missing required field, or non-final fulfillment state is a hard failure.

## Release gate

This contract is not production-ready until the implementation has been exercised against a real paid order and the resulting artifact has independently verified linkage. Test/simulated payments do not satisfy the gate.

## Current blocker

Existing marketplace diagnostic fulfillment is Commander-specific. Reuse of that path without a schema-level compatibility proof is prohibited.
