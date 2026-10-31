# BECK advertising commerce: evidence-gated candidate v1

Scope: reusable BECK substrate for websites, games, and legitimate partner-controlled displays. DreamLedger is one exhaust, not the parent platform. This branch is deliberately NOT wired into production commerce.

## Implemented
- Pure inventory validation scoped by exhaust, silo, and canvas.
- Geometric and time-window exclusion rules; overlapping non-draft claims are rejected.
- Deterministic inventory fingerprints.
- Payment-method contract names: stripe, bank_transfer, paypal, usdc.
- Fail-closed reconciliation result; payment does not establish delivery or independently verified revenue.
- Human approval is still required before advertising goes public.
- No network calls, new services, provider activation, or recurring spend.

## Production requirements before accepting reservations
1. Migrate the pure validator into a transactionally durable inventory store with row locking/exclusion constraints, atomic holds and expiries, idempotency, and parallel oversell regression tests.
2. Reconcile the two inconsistent billboard HTML surfaces and determine the canonical deployment route. Do not assert capacity from an empty visual grid.
3. Implement signed payment-provider callbacks (Stripe), independently reconciled real bank receipts, verified PayPal transactions, and a documented network/finality/valuation/refund policy before enabling USDC. An adapter identifier is not an integrated provider.
4. Build order->creative approval->scheduled placement->served proof->settlement reconciliation with independent evidence. Avoid invented impressions and guaranteed ROAS.
5. Model separate contracts for permanent web tiles, timed premium web sponsorship, game inventory, and physical DOOH only where partner screen access exists.
6. Security and silo tests; rollback plan; finance/legal/public activation approvals.

## Acceptance / rollback
Run: node --test BEC-PRIME/runtime/AdInventoryGate.test.js
Pass condition: all tests pass. Test proof is NOT revenue proof.
Rollback: close draft PR or revert its commits; no live route changed.
