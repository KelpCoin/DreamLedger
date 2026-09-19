# Truth Oracle

Truth Oracle is the evidence boundary for DreamLedger.

Its job is not to make a system look successful. Its job is to distinguish what is observed from what is merely claimed.

## Core ladder

IDEA
-> DOCUMENTED METHOD
-> CODE EXISTS
-> DEPLOYED CAPABILITY
-> SUCCESSFULLY FULFILLED
-> ECONOMICALLY VERIFIED

These states are not interchangeable.

## RA_000001 current public state

- Price authority: CONTRADICTED / live Stripe state currently unreadable from the worker environment.
- Fulfillment path: DEPLOYED_CAPABILITY.
- Test payment: NOT_RUN.
- Successful fulfillment: NOT_PROVEN.
- Independent readback: NOT_PROVEN for real Stripe/Supabase execution.
- Economic outcome: UNVERIFIED.
- Verified external stranger revenue: NZ$0.
- Outreach: APPROVAL_REQUIRED.

## Important distinction

A locally persisted receipt, fossil, specification, or hash can prove artifact integrity.

It does not, by itself, prove that Stripe processed a real test transaction or that Supabase produced fulfillment from that transaction.

Therefore:

LOCAL ARTIFACT INTEGRITY != REAL PAYMENT EXECUTION
REAL TEST EXECUTION != EXTERNAL REVENUE

## Verification rule

No field is promoted without an observed event underneath it.

If evidence is missing, report NOT_PROVEN or UNKNOWN.

If evidence contradicts the claim, report CONTRADICTED.

If execution cannot reach the required external system, report the exact environment blocker.

## RA_000001 next gate

External Stripe/Supabase access
-> real TEST transaction
-> webhook observation
-> fulfillment artifact
-> independent reconstruction
-> acceptance record

No outreach or second commercial cell is promoted by this document.
