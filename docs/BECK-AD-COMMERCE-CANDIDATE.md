# BECK multi-exhaust advertising commerce v1: staged, NOT live

Canonical tracker: https://github.com/KelpCoin/DreamLedger/issues/922
Implementation review branch: https://github.com/KelpCoin/DreamLedger/pull/921

## Implemented on the draft branch
- BECK-wide pure inventory validation (scope: exhaust + silo + canvas + time window + geometry).
- Payment method contract identifiers: stripe, bank_transfer, paypal, usdc. **These are not payment integrations.**
- Backend-only Supabase RPC client, with bounded timeout, service-role authentication and fail-closed validation.
- Transaction-safe SQL migration using scope-level advisory transaction locks and idempotency uniqueness.
- Closed-by-default registered canvas dimensions; no buyer-provided fake canvas capacity.
- Node offline regression tests; no credentials or provider calls required.
- Pull-request CI workflow (pending first cloud runner execution).

## Existing-source audit findings
- The compiled website presents a rich /billboard storefront and references /api/molt-beach-inventory and /api/molt-beach-checkout, but the api/molt-beach-*.ts files referenced by the legacy validator were NOT FOUND at the default branch.
- public/server.js serves public/billboard.html, not the compiled billboard HTML, and does not implement those referenced Molt Beach APIs.
- BEC-PRIME/routes/billboard-v2.js and BEC-PRIME/lib/billboardAutoFulfillment.js each write separate JSON market inventory and differ in their fulfillment behavior. Neither was modified here.
- Live Supabase project was listed HEALTHY but SQL inspection failed with connection refused. No migration was run.
- No provider webhook, crypto custody, PayPal approval, bank account reconciliation, impression tracking or verified new revenue was established by this change.

## Production blockers, in dependency order
1. Confirm actual live serving topology and choose one canonical ad commerce URL/route; reconcile existing claims, pricing, dates and legacy inventory without dropping paid customers.
2. Inventory owner attests to canvases, capacity and historical sold/booked coordinates. Backfill before enabling booking and prove total free footprint using the real data.
3. In an approved database change window, apply migration then test real concurrent reservation races, stale-hold recovery, duplicate idempotency and rollback.
4. Add one supported end-to-end checkout adapter (start with already-connected Stripe), preserve signed session/webhook metadata and payment/attribution evidence. A 30-minute Stripe session must expire before the 60-minute reservation hold. Never charge if placement reservation is unconfirmed.
5. Implement failed/expired/rejected/refunded checkout state machine and human-approved ad content. Stripe settlement is not fulfillment.
6. Add independent serve proof with creative hash, timestamp, canonical QR and exposed duration. Do not invent views, physical DOOH access or audience.
7. Only then evaluate bank transfer, PayPal and USDC rails with independently verified receipts, legal/account compatibility and refund policy.
8. Deploy only after approval, live tests, rollback, fail-closed alerts and no new recurring spend.

## Running the tests
```bash
node --test BEC-PRIME/runtime/AdInventoryGate.test.js BEC-PRIME/runtime/BeckAdReservationClient.test.js
```
No other service required.

## Rollback and truth contract
Close the draft PR or revert its commits. No production route, live Stripe link, public post, Supabase schema or price was changed by this candidate. The current state is STAGED_NOT_DEPLOYED, not a working ad sales system.
