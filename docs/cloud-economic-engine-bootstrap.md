# Cloud Economic Engine Bootstrap

DreamLedger's primary runtime is GitHub Actions. The existing \`777-cycle.yml\` schedule remains the recurring cloud cycle; the one-shot **Cloud Economic Engine Bootstrap** workflow commissions the connected public surfaces and commerce dependencies without requiring the local PC.

## What it does

- On a pull request, runs deterministic buyer-intent and cloud-adapter tests, reads public demand feeds, runs the deterministic internal Gauntlet, probes public health endpoints, and retains internal evidence as a GitHub Actions artifact.
- On manual dispatch from the default branch, probes the public endpoints plus the existing Supabase commerce tables and Stripe webhook/payment-link configuration using existing GitHub secrets. These are GET/HEAD reads only.
- Writes a commissioning report under \`artifacts/777/bootstrap/commissioning-report.json\`; internal candidate/Gauntlet proofs stay under \`artifacts/777/internal/\`.
- Fails closed in the report when a dependency is missing, ambiguous, or unavailable. It does not claim a transaction is proven.

## Run it

1. Open GitHub repository **KelpCoin/DreamLedger**.
2. Open **Actions → Cloud Economic Engine Bootstrap**.
3. Choose **Run workflow** on the default branch.
4. Open the run's artifact named \`cloud-economic-engine-bootstrap-<run_id>\` and inspect \`commissioning-report.json\`.

The workflow uses existing \`SUPABASE_URL\`, \`SUPABASE_SERVICE_ROLE_KEY\`, and \`STRIPE_SECRET_KEY\` secrets only for read-only probes. It does not create or change secrets, alter Stripe configuration, write database rows, deploy services, contact buyers, or spend model credits.

## Local GPU

The cloud cycle does not depend on the PC. Model calls remain disabled unless the GitHub Actions variable `DREAMLEDGER_777_MODEL_CALLS_APPROVED=true` is explicitly set. Local-GPU preference additionally requires `DREAMLEDGER_777_LOCAL_GPU_RELAY_APPROVED=true`, an HTTPS `LM_STUDIO_URL`, and the existing `LM_STUDIO_API_KEY` secret. The key is sent only as a Bearer header and never written to artifacts. The endpoint is not considered ready until it is securely reachable from the cloud runner; no public unauthenticated GPU tunnel should be created. None of these opt-ins was enabled by this change.

## Economic truth

The bootstrap is a commissioning gate, not revenue. Verified external revenue stays NZ$0 until an independent buyer pays, the payment settles, the canonical webhook creates the linked order and fulfillment records, delivery evidence is retrievable, and reconciliation passes.
