# First-Dollar Trajectory Lock

Status: ACTIVE OPERATING POLICY  
Owner: DreamLedger / BrownEye Cortex execution system  
Purpose: prevent architecture work from displacing the shortest evidence-backed route to an independent, fulfilled sale.

## North-star acceptance condition

A cycle succeeds economically only when an independent external buyer, a settled and attributable payment, authorized fulfillment, delivery evidence, and reconciliation are all observed. Until then:

- VERIFIED_EXTERNAL_REVENUE = NZ$0.00
- Settled attributable external payments = 0
- Verified paid fulfilled orders = 0
- Search results, candidate scores, checkout starts, PaymentIntents, code, commits, deployments, and internal ledger rows are not revenue.

## The priority lock

Work in this order. Do not start a lower tier while a higher tier has a concrete, actionable blocker.

1. **Protect the data plane and truth boundary.** Supabase recovery is provider-dependent. Do not apply migrations, issue writes, or claim recovery until a real read-only SQL probe succeeds. Capture the actual support case and provider response; do not claim a ticket was submitted unless its ID exists.
2. **Choose one existing commercial path.** Trace one existing offer from public discovery through buyer intent, price/SKU attribution, checkout, settlement, entitlement, fulfillment, and delivery evidence. Prefer the smallest path with existing code and a plausible buyer. Do not create a new SKU just to avoid fixing an old path.
3. **Prove distribution and demand.** Record a source-bound, recent signal of buying intent and a permitted distribution route. A search hit is a candidate, not a buyer. No personal outreach, public posting, paid spend, or account change without the required authority.
4. **Make the transaction safe.** Require exact SKU/price/currency binding, server-side price resolution, signature verification, atomic webhook idempotency, durable order/entitlement/fulfillment writes, retry-safe delivery, and refund/dispute handling before taking live payment for that path.
5. **Run an end-to-end test.** First use test mode and adversarial duplicate/retry cases. A test proves test behavior only. A live sale counts only after independently observed settlement and delivery.
6. **Only then scale or add features.** Expand channels, products, A2A rails, bandits, tenant spawning, x402, or game-economy scope only when the previous loop has evidence and a clear unit-economic reason.

## Trap detectors and automatic response

| Trap | Detection rule | Required response |
|---|---|---|
| Architecture drift | Proposed work does not remove a named blocker, prove demand, improve delivery, or reduce material risk for the selected path | Reject or defer it |
| New-surface bias | A new page, SKU, protocol, queue, ledger, or orchestrator is proposed while an existing path is unproven | Reuse the existing substrate; no duplicate system |
| Fake-green status | Dashboard/control-plane health is used as proof of data-plane availability, or CI is used as proof of production behavior | Downgrade to UNVERIFIED; require direct probe |
| Checkout/revenue conflation | Session, PaymentIntent, redirect, or webhook receipt is reported as revenue without settlement and fulfillment reconciliation | Keep revenue at NZ$0.00 |
| Non-atomic webhook | Event dedupe and business side effects are not committed atomically under a unique event ID | Block live release |
| Local-file commerce | RFQs, offers, orders, entitlements, or fulfillment depend on process-local JSON in a production multi-instance path | Block enterprise-ready claim and live order creation |
| Unverified external claims | A deployment, support ticket, buyer contact, payment, or delivery is inferred from a commit or intended action | Report NOT VERIFIED until the external artifact exists |
| Endless preparation | Two consecutive work cycles create only plans/research without removing a blocker or improving a testable buyer path | Stop research; select the highest-value concrete repair or demand test |

## Scope budget

- One primary commercial path at a time.
- One active blocker being removed at a time, with parallel work only when independent and safe.
- No new protocol or product family before the first existing path passes its acceptance contract.
- Keep PhinHaven as the long-term product/world vision, but do not use future game scope to excuse failure to validate a near-term commercial loop.
- DreamLedger remains the verification and commerce rail; BrownEye Cortex remains the parent system; Elohim discovers and ranks opportunities. None may override authority or truth gates.

## Required task envelope

Every execution task must state:

- **Outcome:** the specific blocker or commercial transition to change.
- **Evidence:** source, timestamp, and current truth label.
- **Preconditions:** including required external services and permissions.
- **Bound:** files/routes, budget, attempts, time, network and authority scope.
- **Acceptance:** deterministic test or externally observable artifact.
- **Failure path:** fail closed, record the reason, and identify the next viable route.
- **Economic relevance:** how this shortens time to first buyer/payment/delivery or materially reduces risk.

## Current locked position (2026-10-10)

- Supabase data-plane recovery: BLOCKED / requires provider recovery and direct verification.
- Quote comparison: free utility; do not revive the legacy NZ$49 offer as a paid product by assumption.
- A2A checkout: NOT RELEASED until durable order creation, settlement, entitlement, fulfillment, and evidence are proven.
- B2B persistence: NOT ENTERPRISE-READY while local JSON or an unverified schema remains in the production path.
- Stripe webhook idempotency: NOT RELEASED until duplicate/concurrent processing is prevented atomically.
- x402 mainnet: OFF until identity, authorization, exact asset/payee binding, spend caps, replay protection, simulation, settlement, and delivery evidence are tested.
- Verified external revenue: NZ$0.00 until the complete evidence chain is reconciled.

## Completion rule

The next successful cycle must produce one of:
1. a verified reduction of a critical blocker with tests/evidence; or
2. a genuine, independently verifiable economic outcome; or
3. if execution is externally blocked, a precisely evidenced blocker and the minimum provider/user action required to clear it.

No cycle may declare success solely because it produced more candidates, documentation, routes, pages, or code.
