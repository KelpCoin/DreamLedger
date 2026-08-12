# DreamLedger / BEC-PRIME

DreamLedger is the public commerce surface for the BEC-PRIME sovereign commerce kernel. The repository is now in execution mode: architecture is frozen and the objective is verified revenue, not additional architecture work.

## First cash target

- Product: Commander Deck Diagnostic
- SKU: COMMANDER-DECK-DIAGNOSTIC-001
- Price: NZD 25.00
- Status: published
- Inventory: 999999
- Approval required: false
- Payment adapter: Stripe Checkout
- Checkout route: POST /api/offer-checkout/create
- Success route: /checkout/success
- Cancel route: /mtg?checkout_cancelled=1
- Public domain: https://dreamledger.org

The product record is checkout-eligible but has no payment proof yet. A successful payment is not claimed until a signed Stripe webhook produces FIRST_PAYMENT_PROOF.json.

## Money gate

The real commercial loop is:

DEMAND -> ELOHIM -> OFFER -> GAUNTLET -> CHECKOUT -> PAYMENT -> FOSSIL -> FULFILMENT -> CAPITAL -> COMPOUND

The current hard gate is:

REAL BUYER -> STRIPE PAYMENT -> SIGNED WEBHOOK -> FIRST_PAYMENT_PROOF.json

Until that file exists with a real Stripe transaction/session identifier, revenue remains $0/unproven.

## Runtime

The canonical runtime is `BEC-PRIME/start.js`, launched through the root compatibility entrypoint. It binds to `0.0.0.0` and Render's `PORT`.

Health endpoint:

`GET /healthz`

Product surface:

`GET /api/products`

`GET /api/products/COMMANDER-DECK-DIAGNOSTIC-001`

Checkout surface:

`POST /api/offer-checkout/create`

Webhook surface:

`POST /webhook`

Stripe configuration required by the runtime:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- optional `PUBLIC_BASE_URL` (defaults to https://dreamledger.org)

The Stripe webhook must point to the actual runtime route `/webhook`. Do not use the obsolete `/api/stripe/webhook` route.

## First-sale tools

Generate a real Stripe Checkout session without charging anyone:

`powershell -NoProfile -ExecutionPolicy Bypass -File .\BEC-PRIME\scripts\Start-FirstSale.ps1`

Run the production truth gate:

`powershell -NoProfile -ExecutionPolicy Bypass -File .\BEC-PRIME\scripts\Verify-CashNow.ps1`

The verifier writes its local proof to:

`D:\BEC_CASH_NOW_PROOF.json`

The first-sale launcher writes the generated checkout URL and diagnostic result to:

`D:\BEC_FIRST_SALE.json`

## Revenue evidence

A real successful Stripe Checkout payment causes the webhook handler to write:

`data/proofs/FIRST_PAYMENT_PROOF.json`

and a transaction-specific copy:

`data/proofs/FIRST_PAYMENT_PROOF-<stripe-session-id>.json`

Those are the Fossil evidence artifacts. The repository must never manufacture them as a substitute for a real payment.

## Frozen architecture

The architecture is frozen as:

1. Sensors: demand and friction signals.
2. Brain / Elohim: scoring, refinement, and deterministic gates.
3. Factory: product and offer compilation.
4. Commerce Spine: signal through payment and delivery.
5. DreamLedger: durable evidence and verification.

The named primitives are Browning Gauntlet, Fossils / Level 1 Evidence, and CUBE. No new architecture is required to run the first-revenue experiment.

## Current truth on 2026-08-12

- GitHub: pushed to `main`.
- Commander product: checkout-eligible.
- Checkout code: present.
- Stripe credentials in production: not observable from GitHub and must be tested against the live endpoint.
- Real payment: $0 until a buyer pays.
- FIRST_PAYMENT_PROOF.json: absent until the first real successful webhook.

## Proof discipline

A build, deployment, smoke test, generated checkout session, or dashboard screenshot is not revenue evidence. Only a successful payment followed by a valid webhook-generated Fossil moves the system from `PAYMENT_UNPROVEN` to `PAYMENT_PROVEN`.

## Immediate operator sequence

1. Run `Start-FirstSale.ps1`.
2. If it returns a checkout URL, send that URL to a real buyer.
3. If it reports missing Stripe configuration, configure the Render environment variables.
4. Configure Stripe's webhook destination as `https://dreamledger.org/webhook`.
5. Run `Verify-CashNow.ps1` again.
6. After the first successful payment, verify `data/proofs/FIRST_PAYMENT_PROOF.json` exists and contains a real transaction/session identifier.

The machine is not considered monetized before step 6.
