# Payment Boundary Remediation Runbook
Date: 2026-10-09
Status: OPEN / NOT PRODUCTION-READY
Truth boundary: no credential rotation, database migration, or production function change was performed by this audit.

## Confirmed observations
- The Supabase migration-list operation currently fails with ECONNREFUSED to the project's direct IPv6 address on port 5432. This confirms the connection failure, not its root cause.
- Read-only inspection found a hard-coded Stripe webhook signing-secret-shaped value in the legacy `dreamledger-stripe-webhook-v2` Edge Function source. The secret value must not be copied into issues, logs, documentation, or chat.
- Stripe-related Edge Functions include multiple endpoints with `verify_jwt=false`. This setting is not, by itself, proof of vulnerability: Stripe webhook handlers must authenticate with Stripe signature verification, while internal endpoints need their own verified service-to-service gate.
- Current source inspection did not establish that the active payment path writes a causally linked, atomic `transactions` plus `digest_ledger` record. Payment-status and PaymentIntent-metadata handling markers exist in some functions, so review the exact active branches before declaring them absent.
- Revenue remains UNVERIFIED; the verified external revenue scoreboard remains NZ$0.00.

## Ordered remediation

### 1. Contain the exposed signing secret without breaking the live endpoint
- Map each Stripe Dashboard webhook endpoint to its destination URL and deployed function.
- Determine whether the legacy v2 endpoint is still configured or receiving events. Do not assume the newest function is the active endpoint.
- In Stripe Dashboard, rotate/regenerate the affected endpoint secret using the supported overlap flow if available.
- Configure the new secret through the supported server-side secret store/deployment configuration. Never commit it or print it.
- During overlap, accept only signatures verified against the active old/new endpoint secrets as appropriate to the provider's rotation mechanism.
- Send a Stripe test event and confirm a valid event succeeds and a modified/invalid signature is rejected.
- Remove the old secret from the function source, redeploy, then retire the old endpoint/secret only after live routing and delivery are confirmed.
- Review repository history and deployment logs for exposure. Rotation is still required even if the value is removed from the current source.

### 2. Restore safe, read-only Supabase inspection
- Obtain the Session Pooler connection string from the Supabase Dashboard; do not invent or reconstruct credentials.
- Test DNS resolution and TCP/Postgres connectivity with `psql` using the supplied pooler host/port.
- Confirm the actual connection endpoint used by each migration tool. A CLI that re-derives the direct IPv6 URL may still fail even when a pooler URL exists.
- If CLI migration behavior is still broken, use a reviewed SQL migration through the Dashboard SQL editor only after schema and migration history are inspected.
- Do not apply DDL while current schema/migration state is unknown.

### 3. Correct the 777 commercial fallback
- Review PR #546 and ensure deterministic fallback behavior never manufactures an offer, buyer, purchase, or external result.
- A fallback may emit an internal diagnostic or a source-grounded artifact; it must not be counted as demand or revenue.
- Keep a no-money/no-qualifying-artifact cycle visible as a failed or blocked cycle rather than fabricating a pass.

### 4. Make payment processing attributable and idempotent
- At checkout creation, attach stable internal `offer_id` and `buyer_id` metadata to the PaymentIntent via `payment_intent_data.metadata` for one-time Checkout, while retaining Checkout Session metadata where useful.
- Use server-controlled Stripe Price IDs and compare actual line items/currency/amount against the expected offer policy. Account for discounts and automatic tax explicitly rather than trusting client-supplied amounts.
- Process only eligible paid states: check `payment_status` for `checkout.session.completed`, and handle asynchronous success events as appropriate.
- Make event deduplication, payment observation, entitlement/order update, and ledger append one database transaction/RPC. A unique Stripe event ID or processed-event primary key must make retries safe.
- Use transaction-scoped serialization (for example, a transaction advisory lock or SERIALIZABLE with bounded retries) plus idempotency constraints. A unique index on `previous_hash` can help reject forks but does not alone prove chain continuity or prevent unauthorized writers.
- Reconciliation must be able to replay Stripe's authoritative event/payment state without duplicating entitlements or ledger entries.

### 5. Enforce authorization at every internal boundary
- Keep Stripe webhook JWT verification disabled only when the handler verifies Stripe's signature against the raw request body and fails closed.
- For internal Edge Functions, keep gateway JWT verification enabled where applicable or use a supported service-to-service secret/auth mode and verify it server-side. Never expose service-role credentials to anonymous callers.
- Do not bulk-change every `verify_jwt=false` function without checking its caller contract and deployed handler.
- Use least-privilege credentials for untrusted-source ingestion; check every HTTP status and response body, fail the workflow on fetch/insert errors, and use a durable watermark plus unique source/external ID for deduplication.
- Keep secrets in the supported secret store (for database-originated scheduled calls, Supabase Vault where appropriate), never in plaintext settings or repository files.

### 6. Validate the causal chain and failure behavior
Acceptance tests:
- valid Stripe signature accepted; invalid or altered payload rejected;
- unpaid Checkout completion does not create a settled payment or entitlement;
- duplicate event replay creates no duplicate order, entitlement, or ledger event;
- concurrent appends cannot create two successors from the same chain head;
- stale or fabricated RA-stage names without linked authoritative evidence fail closed;
- payment record references Stripe event/payment intent, expected offer, stable internal buyer ID, and resulting fulfillment delivery ID;
- ingestion 4xx/5xx, timeout, malformed response, and unauthorized writes fail the workflow visibly;
- anonymous callers cannot invoke privileged internal functions;
- reconciliation repairs missing internal observations without inventing external settlement.

## Release gate
No migration or production rollout is complete until schema inspection succeeds, code/tests pass, the active Stripe endpoint is mapped, and live/test events prove the intended authentication and idempotency behavior. No claim of revenue is allowed until independent settlement and fulfillment evidence is observed.
