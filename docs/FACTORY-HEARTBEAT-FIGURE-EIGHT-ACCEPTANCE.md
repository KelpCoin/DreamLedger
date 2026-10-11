# Factory heartbeat and Figure Eight acceptance

## Local heartbeat

Run from PowerShell on the Windows host:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\operations\Start-BrownEyeFactoryHeartbeat.ps1 -Once
```

The script writes evidence to `D:\BrownEyeCortex\proofs\factory-heartbeat\heartbeat-latest.json` (or the user's home directory if D: is unavailable). Omit `-Once` to poll continuously every 60 seconds. Each poll checks the LM Studio OpenAI-compatible API, sends a small inference request to every model exposed by that API, samples NVIDIA GPU telemetry before and after, and records whether at least three models passed.

**Important:** this script does not load models automatically. Model identifiers, VRAM, quantization, and the user's available memory must be inspected before attempting to load three resident models. A model shown by `lms ls` is installed, not necessarily loaded. A model shown by `/v1/models` is exposed by the server, but the inference probe is still required.

## Figure Eight membrane

The online probe is opt-in. Configure `BEC_MEMBRANE_URL` to the actual authenticated endpoint, and optionally set `BEC_MEMBRANE_TOKEN` in the process environment. Then run with `-RunMembraneProbe`.

A successful response must echo the exact `task_id` and unique `nonce`, set `processed: true`, and provide a non-empty `receipt_id`. Any missing or mismatched field fails the probe. The probe uses connectivity-test data only, not customer data. Do not point it at an arbitrary endpoint. No production membrane endpoint is assumed by this script.

This verifies a request/response round trip only. A complete production Figure Eight acceptance test additionally needs a server-side durable receipt, replay rejection, authentication, timestamp/expiry checks, local reconciliation, and proof that the receipt survives restart. Until those are implemented and tested, the production membrane status is **UNVERIFIED**.

## Fulfillment wall release gates

Every Elohim-generated artifact remains private until all of these are true:

1. Stable product ID, version, deliverable schema, scope, and acceptance criteria exist.
2. Price and currency are explicitly approved and match the Stripe Price ID used by checkout.
3. Checkout attribution includes the product ID/version and an idempotency-safe order reference.
4. A verified Stripe webhook confirms the correct payment is settled; a checkout redirect or PaymentIntent alone is not fulfillment proof.
5. Entitlement issuance is scoped to the paid product/order, expires or revokes when appropriate, and cannot be reused for another buyer/order.
6. Fulfillment executes and stores a delivery receipt with artifact hash, timestamp, order reference, and outcome.
7. The buyer can retrieve the promised artifact through the wall; failed delivery enters a retry/recovery or refund path.
8. The public catalogue is generated from the same approved product/price registry. Unpriced, unmatched, review-required, or unfulfillable artifacts cannot be published as purchasable.

## Current proof boundaries

A local model test does not prove online reachability. A heartbeat timestamp does not prove useful work. A public Stripe link does not prove settlement, attribution, entitlement, or delivery. Each gate needs its own evidence. The economic scoreboard remains unchanged until a real external buyer pays and receives the promised product.
