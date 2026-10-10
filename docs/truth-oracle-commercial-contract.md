# Truth Oracle commercial contract

Status: acceptance contract, not a claim that production currently satisfies it.

## Product family

Truth Oracle is the customer-facing family for evidence-backed comparisons and decision support. Supplier Quote Comparison is one use case inside that family, not a separate business strategy.

- **Free entry:** a small, useful answer or sample result that demonstrates the evidence model and captures only the minimum data needed to deliver it.
- **Paid standard:** multi-document extraction and comparison, explicit missing-data reporting, downloadable result, and a traceable delivery receipt.
- **Paid higher-value:** larger batches, repeat runs, API/agent access, and business-specific workflows only after the standard path has independently proven demand and fulfillment.
- **Crypto-capable checkout:** an optional rail, never a prerequisite for launch. Show it only after the merchant account, jurisdiction, settlement destination, webhook verification, refund path, and reconciliation are confirmed.

Prices and limits are experiments. Product family, honest evidence labels, and one clear next action remain consistent.

## First commercial path

1. A real external buyer reaches a Truth Oracle page through discoverable intent, not paid ads or personal outreach.
2. The page explains the exact inputs, outputs, limitations, price, refund/support route, and delivery expectation before checkout.
3. The buyer completes a live payment on an enabled rail.
4. The server verifies provider-side settlement and binds the transaction to a unique order, SKU, entitlement, and fulfillment request.
5. The buyer submits valid inputs; processing returns a usable artifact or a clear review-needed/refund state.
6. Delivery is independently retrievable and has a timestamped evidence reference.
7. A reconciliation job matches provider transaction, order, buyer provenance, fulfillment, and delivery evidence.

A checkout session, payment intent, webhook receipt, database row, test payment, generated file, or HTTP 200 alone is not verified revenue.

## Gauntlet hard gates

A candidate cannot be labelled acquisition-ready or revenue-ready unless the following are evidenced:

- **Independent buyer:** buyer is not the owner, owner-controlled account, household/family tester, internal agent, or test identity. Where legally and technically appropriate, compare normalized customer identifiers and known test identities without retaining unnecessary personal data.
- **External settlement:** provider confirms a live successful payment; test mode, authorization-only, unpaid, expired, reversed, refunded, disputed, and unmatched transactions are excluded or separately labelled.
- **Order attribution:** provider transaction maps uniquely to the expected product/SKU, price/currency, order, and entitlement.
- **Fulfillment:** the service processed the buyer's actual inputs and produced the promised result, or recorded an explicit failure/refund path.
- **Delivery evidence:** the delivered artifact is retrievable, linked to the order, timestamped, and checksummed where practical. Parser completion alone is not evidence of customer value.
- **No false green:** missing, stale, contradictory, simulated, or unverified evidence blocks the green status. Each blocker names the smallest safe next action and proof required.
- **Economic scoreboard:** report independent buyers, settled external payments, fulfilled paid orders, verified outcomes, refunds/disputes, and net proceeds separately. Never count owner/family testing as demand.

## Payment rails

- Keep the existing fiat checkout as the baseline while it is verified end to end.
- Stripe stablecoin acceptance is not assumed available to a New Zealand merchant; enable it only if the actual Stripe account is approved and the payment method appears as active in the dashboard.
- A separate crypto/stablecoin provider may be evaluated, but only after confirming New Zealand business eligibility, supported chains/tokens, fees, custody/settlement, tax/accounting treatment, refunds, webhook signatures, idempotency, and independently reconcilable transaction IDs.
- Never accept a raw wallet address or a client-supplied transaction hash as sufficient proof of payment. Verify confirmation/settlement through the provider or a trusted chain-indexing mechanism and reconcile it to a unique order.
- Do not introduce a second payment provider merely to make a checklist green. It must improve reach or conversion without adding unbounded operational risk.

## Release states

- **RED:** buyer/payment/fulfillment path broken or unsafe.
- **AMBER:** partially implemented, untested, unmatched, or dependent on unavailable evidence.
- **GREEN (technical):** automated checks pass for the stated scope.
- **GREEN (commercial):** independent external settlement, successful fulfillment, delivery evidence, and reconciliation are all proven.
- **VERIFIED REVENUE:** only net external settled payments tied to independent buyers and fulfilled orders, after exclusions/refunds/chargebacks under the accounting policy.

Technical green never implies commercial green.

## Immediate order of work

1. Repair and prove the existing fiat path with test identities excluded from economic metrics.
2. Fix the Truth Oracle family landing and routing so free entry and paid upgrades are explicit, without creating more disconnected silos.
3. Run an external-buyer acquisition experiment using existing discoverable intent and no paid advertising or personal outreach.
4. Add provider-neutral payment provenance so future fiat and crypto rails use the same order/fulfillment/evidence contract.
5. Evaluate a crypto rail only after eligibility and reconciliation are proven.
6. Expand offers and price points after one independent buyer is successfully served.

No production status may be upgraded on the basis of this document alone.
