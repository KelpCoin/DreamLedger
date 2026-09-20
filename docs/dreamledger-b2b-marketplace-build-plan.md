# DreamLedger B2B Marketplace Build Plan

## Product thesis
DreamLedger is a marketplace surface backed by evidence-backed transaction provenance. The differentiator is a testable trust layer, not a claim of incumbent replacement.

## Current commercial truth
Verified external revenue: NZ$0.
Do not count tests, internal transactions, simulations, or self-purchases.

## Money path
Seller onboarding/KYC → cart checkout → platform charge → per-seller Connect transfers → shipping/fulfillment → seller payout → review → reconciliation.

## Existing foundations
- marketplace listings, sellers, orders and fulfillment model
- Stripe marketplace settlement RPC
- Stripe webhook
- marketplace seller account model
- marketplace transfer ledger
- verified-purchase review model
- dispute model
- collection/import infrastructure
- public B2B marketplace surface

## Immediate gates
1. Verify checkout creation sets payment_intent_data.transfer_group=order_<order_id> before confirmation.
2. Verify the existing platform-scoped Stripe webhook source before any live deployment.
3. Establish the connected-account webhook path for account and payout lifecycle events before advertising seller payouts.
4. Complete seller Connect onboarding only with explicit authorization for live financial actions.
5. Implement shipping only after the payment allocation path is verified.
6. Add reservation, search, media verification and seller analytics after the money path is working.

## Trust primitive
AUTHORIZATION → ACTION → EXTERNAL EFFECT → EVIDENCE → VERIFICATION

## Agent receipt experiment
Publish one real receipt from a real external action on one external surface. Wait one week. Do not manufacture a receipt or count internal reactions.

## Acquisition
A useful response to an existing buyer problem is preferred over unsolicited pitching. For the historical CMD-DIAG-29 experiment, a current Commander help thread may be used only if the response is genuinely useful and complies with the community's rules. A buyer asking for deeper help is evidence of demand; a generic audience is not.

## Stop condition
Do not add another agent, offer, marketplace subsystem, landing page, or automation merely to avoid the commercial test. New infrastructure requires evidence that an existing bottleneck actually requires it.
