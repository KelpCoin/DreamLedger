# Agent Bridge monetization MVP: one toll road, one contract

Status: proposal for review. This document does not claim a dedicated API SKU, usage debit, or live paid access exists.

## Decision

Start with one prepaid entitlement: **NZ$19 for 100 billable authenticated API operations**. Free public discovery remains available. Do not launch per-request micro-charges first: payment fees and reconciliation overhead make tiny tolls unattractive, and the user should understand the cap before execution.

After the first paid entitlement has passed live payment-to-delivery verification, test a **NZ$29/month route lease with 2,000 calls/month**. Do not create recurring billing or overage until actual usage justifies it.

## What the customer buys

- A revocable API token tied to a canonical SKU and purchase entitlement.
- 100 authenticated billable operations.
- A machine-readable remaining-allowance response and usage receipt.
- Idempotent retry semantics.
- Hard stop at zero; no surprise overage.
- Request/correlation identifiers and a documented error contract.

The purchase does not buy human approval, authority to execute consequential external actions, or a claim that any business outcome is verified.

## Billable unit

One **billable authenticated operation** means an accepted, authorized request that enters a metered work route. Candidate routes are event writes, job claims/completions, and rail lease/stage operations. Final route allowlist must be derived from the existing server route implementation, not guessed from public documentation.

Exclude public discovery reads, manifest/health probes, unauthorized requests rejected before work, and duplicate retries with the same idempotency key and same request digest.

## Required sequence

1. Buyer starts a dedicated Stripe Checkout session for the Agent Bridge SKU.
2. Server verifies the signed webhook and the actual settled payment. A redirect or browser success page is not proof.
3. Existing commerce processing maps the canonical SKU to a paid entitlement idempotently.
4. Issue a scoped, revocable token. Show the secret once; do not log it or store it in public source.
5. Before a billable side effect, atomically reserve one call against that entitlement.
6. If the request repeats with the same tenant, idempotency key, and request digest, return the original result and do not debit again. A reused key with a different digest is a conflict.
7. If the allowance is exhausted, return a machine-readable quota error and perform no side effect. No implicit overdraft.
8. Reconcile payment, entitlement, usage reservation, result delivery, and evidence using the existing commerce and economic-observation contract.

## Architecture constraints

- Keep Stripe as payment settlement evidence.
- Reuse existing revenue order/entitlement/fulfillment and production-observation modules. Do not create a second ledger, queue, or truth system.
- Use the existing authoritative persistence layer for atomic quota reservation. If that atomic operation cannot be implemented safely, the route must fail closed; a process-local counter is not a production quota.
- Supabase availability is currently a known dependency risk. Do not claim the paid API path is operational until persistence and the quota reservation are live and verified.
- No token issuance, purchase, public post, or consequential external action may bypass the relevant authorization gate.
- No x402 or MPP payment rail is described as live until separately implemented and tested.

## Acceptance gate

A release candidate must pass all of these tests against the deployed route:

1. Public manifest and health work without a token.
2. Protected route rejects missing, malformed, revoked, and wrong-scope tokens.
3. Settled Stripe payment creates exactly one entitlement despite duplicate webhook delivery.
4. A test entitlement allows exactly 100 billable operations.
5. Parallel requests cannot overspend the allowance.
6. A duplicate idempotent request returns the original result and consumes no second unit.
7. A conflicting idempotency-key reuse is rejected.
8. The 101st distinct operation is blocked before its side effect.
9. Refund/revocation behavior is defined and prevents new use.
10. Fulfillment receipt contains canonical SKU, Stripe payment reference, entitlement reference, request/correlation IDs, usage result, and evidence reference without exposing secrets.
11. Real-browser checkout, settled payment, token delivery, API call, and fulfillment are observed end-to-end.
12. Only a real external buyer and settled payment may move verified external revenue above NZ$0.

## Commercial ladder

- **Free:** public discovery and machine-readable contracts.
- **NZ$19 once:** 100 billable API calls (proposed, not yet purchasable).
- **NZ$29/month:** 2,000 billable calls on a named route (proposed; only after first paid proof).
- **Later:** paid proof attestation and route leases with explicit service levels, only if buyers demonstrate demand.

The existing NZ$79 Discord Webhook Starter Kit is a separate downloadable integration product. It does not grant API quota and must not be represented as the Agent Bridge SKU.

## Current evidence boundary

Live public manifest currently reports Agent Bridge schema version 1.3, configured=true, and authentication required for work. That verifies public surface/configuration only. It does not prove authenticated production traffic, paid entitlement issuance, metering, or revenue. The published toll manifest previously linked unrelated purchases as adjacent purchase targets; this proposal separates those products from API access so that a purchase cannot be misrepresented as an API entitlement.
