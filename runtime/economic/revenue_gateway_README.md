# DreamLedger Revenue Gateway

This is a policy/control boundary around the existing QUOTE-COMPARE-49 fulfillment path.

It does not create revenue, replace the fulfillment worker, create a ledger, create a queue, send outreach, charge Stripe, or promote evidence to VERIFIED.

The offline contract evaluates FULL, REDUCED, QUEUED, and REFUSED from explicit capability facts. It fails closed.

REDUCED is allowed only when a deterministic fallback exists and unresolved fields remain explicitly unresolved. It does not change the paid commercial promise.

QUEUED is not payment-authorized by default because delayed fulfillment may be a different commercial contract.

The connected operator must inspect live schema and dependency state before applying the migration or deploying the Edge Function.

All bundle-generated decisions are INTERNAL/TEST/UNVERIFIED until live evidence proves otherwise.
