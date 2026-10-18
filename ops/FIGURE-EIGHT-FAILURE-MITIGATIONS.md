# Figure Eight: failure containment and recovery plan

Status: implementation plan grounded in known DreamLedger failure modes. A mitigation is not considered complete until a test or production read-back proves it.

## Operating rules

- Verified revenue remains NZ$0.00 until an independent buyer's settled payment is correctly attributed, fulfilled, delivered, and supported by durable evidence.
- Do not spend, trade, change billing, publish a payment claim, or perform an irreversible action without the required approval gate.
- Prefer one canonical ledger and one verification schema. Do not create parallel ledgers to work around a broken provider.
- Treat dashboards, heartbeats, checkout starts, successful builds, and HTTP 200 responses as availability signals, not revenue proof.
- Every automated repair must be bounded, idempotent, observable, reversible where possible, and followed by read-back verification.

## Failure class 1: website, hosting, DNS, and build-provider outage

1. **Independent static origin:** keep a static export in the repository and a deployable secondary host. The failover must not require the primary host's build pipeline.
2. **Repeatable deployment:** use a versioned CI workflow that validates the output directory, required assets, CNAME, and key routes before publishing.
3. **External route probes:** check the apex, www, MTG landing page, and catalogue route from outside the hosting provider. Alert only through the configured daytime-safe channel.
4. **DNS ownership and rollback record:** record the intended apex/www targets and previous values before any cutover. Never change DNS based only on a failed build.
5. **Recovery proof:** after cutover, verify HTTP status, content identity, critical asset loading, and catalogue fetch. Keep the prior origin available until the new origin passes.

## Failure class 2: Stripe webhook duplication and payment attribution

1. **Durable event deduplication:** use a unique Stripe event ID in a durable event table or equivalent atomic store.
2. **Atomic state transition:** deduplication and order-state transition must be transactional, or use an outbox/inbox pattern. Do not rely on a non-atomic "insert then delete on error" workaround.
3. **Signature validation:** verify the raw request body against the Stripe signature before trusting the event.
4. **Canonical attribution:** match the canonical offer/SKU, checkout session, payment intent, currency, amount, and order. Reject ambiguous or mismatched events into a quarantine queue.
5. **Replay tests and reconciliation:** test duplicate delivery, out-of-order events, timeout/retry, refund, and dispute cases. Reconcile provider events against the ledger before marking a payment settled.

## Failure class 3: database outage, connection failures, and provider lock-in

1. **Connection strategy by environment:** use the provider's documented IPv4-compatible pooler or supported connection endpoint when direct connectivity is unsuitable; verify prepared-statement and transaction compatibility instead of assuming it.
2. **Bounded retries:** retry only transient failures with exponential backoff and jitter; impose connection and query timeouts.
3. **Durable backups and restore drills:** export schema and data on a defined schedule and test restore into a clean PostgreSQL instance. A backup that has not been restored is unproven.
4. **Portable data contract:** keep migrations, constraints, seed data, and queries in version control; avoid provider-only database features for canonical economic records unless isolated behind an adapter.
5. **Fail closed for money:** when the ledger is unavailable, do not report settlement, issue paid access, or fulfil an order from a cached or inferred state. Queue safely and reconcile after recovery.

## Failure class 4: silo contamination and tenant isolation

1. **Tenant-scoped records:** every tenant-owned record must carry a validated tenant/silo identifier and enforce it at the data-access boundary.
2. **Authorization tests:** test cross-silo read, write, update, export, and object-reference attacks in CI.
3. **Resource budgets:** apply per-silo query, job, storage, and request limits so one tenant cannot exhaust shared resources.
4. **Migration isolation:** test migrations against a disposable database and a representative silo before production; make migrations backward-compatible where possible.
5. **Isolation by measured need:** use schema-per-tenant only when operational cost and migration complexity are justified. Strong logical isolation and bounded resources are the default; never create hundreds of schemas as an untested response to a theoretical risk.

## Failure class 5: checkout UI promises more than the payment rail can prove

1. **Server-authoritative availability:** checkout availability is determined from a canonical offer manifest and server-side state, never a client-side flag alone.
2. **No false purchase button:** when no verified payment URL exists, show "Request to purchase" or "Unavailable", not "Buy now".
3. **Offer consistency:** validate displayed price, currency, SKU, Stripe product/price/link, and fulfillment contract against one canonical offer record.
4. **End-to-end canary:** use a clearly labelled test mode to prove checkout creation, webhook receipt, order attribution, delivery, and evidence generation before enabling the live CTA.
5. **Independent-buyer proof:** never count owner tests, unpaid sessions, checkout starts, or a payment without delivery evidence as verified revenue.

## Failure class 6: secrets, RLS, and privileged database access

1. **No privileged client secrets in browser bundles:** service-role keys and provider secrets stay in server-side secret storage.
2. **Least privilege:** use user-scoped credentials for ordinary operations and a separate narrowly scoped server credential for privileged tasks.
3. **RLS negative tests:** verify anonymous, authenticated, cross-tenant, and revoked-user access against real policies in CI.
4. **Secret scanning and rotation:** scan commits and build artifacts; rotate any exposed key and review access logs after suspected exposure.
5. **Audited admin paths:** privileged mutations require a narrow API, structured audit record, actor identity, and explicit authorization. Prompt text is never authorization.

## Failure class 7: heartbeats, agents, and automation loops

1. **Heartbeat is liveness only:** a heartbeat proves only that a component checked in, not that a job completed or revenue occurred.
2. **Lease and idempotency:** jobs use a durable job ID, lease/claim, bounded retries, and an idempotency key to prevent duplicate side effects.
3. **Dead-letter and quarantine:** repeated failures stop retrying indefinitely and preserve the input, error, attempt count, and next safe action.
4. **Circuit breakers:** pause a failing dependency after a threshold; do not let an agent spawn more workers or silos while the canonical ledger or deploy path is unhealthy.
5. **Bounded autonomy:** enforce allowlisted actions, time/resource limits, dry-run for destructive changes, approval gates for spend/public/legal/irreversible actions, and an auditable kill switch.

## Failure class 8: delivery, evidence, and ledger reconciliation

1. **Explicit order state machine:** keep payment, fulfillment, delivery, and evidence as distinct states with allowed transitions.
2. **Durable evidence bundle:** preserve provider event IDs, order/SKU attribution, timestamps, delivery artifact reference, and integrity hash.
3. **Independent reconciliation:** compare Stripe settlement records, order records, fulfillment records, and delivery evidence; mismatches become UNMATCHED, not revenue.
4. **Retry-safe fulfillment:** use a unique order/fulfillment key and make delivery retries idempotent.
5. **Evidence completeness gate:** only mark verified revenue after all required links exist and pass checks; missing evidence keeps the amount at NZ$0.00 verified.

## Failure class 9: autonomous trading and arbitrage proposals

1. **No funded trading by default:** no wallet funding, market orders, MEV execution, or yield deployment without a separately approved budget and risk policy.
2. **Paper-trading first:** replay historical data and then run shadow mode with fees, slippage, latency, and failed transactions included.
3. **Independent risk limits:** cap exposure, loss, gas, trade frequency, and wallet balance; enforce limits outside the agent's own prompt.
4. **Adversarial data checks:** treat news, social posts, market APIs, and contract metadata as untrusted; require source timestamps and cross-source corroboration.
5. **Profit verification:** calculate net realized profit after fees, failed transactions, inventory/liability, and tax/accounting effects. A claimed win or wallet balance change is not a revenue proof by itself.

## Failure class 10: operational thrash and unbounded silo spawning

1. **One canonical work queue:** assign each failure a stable ID, owner, severity, and acceptance test.
2. **One active commercial path:** prioritize restoring the public front door and completing one existing offer's payment-to-delivery loop before spawning new silos.
3. **Failure budgets:** stop deployments and expansion when critical health checks fail or repeated repairs do not improve the measured result.
4. **Change isolation:** small reviewed changes, one concern per change, and a known rollback target; do not mix deployment repair with unrelated product launches.
5. **Outcome-based promotion:** a silo graduates only after an independent buyer, settled payment, correct attribution, delivery, and evidence are verified.

## Implementation order

P0: restore and independently verify the static website; fix the broken catalogue-loading path; keep checkout claims truthful.
P1: verify the canonical Stripe-to-order-to-delivery chain and idempotency.
P2: prove database backup/restore and document the portable PostgreSQL contract.
P3: add cross-silo authorization tests, automation circuit breakers, and evidence reconciliation.
P4: consider x402, trading, or swarm expansion only after the above gates pass.

## Current known blockers

- `dreamledger.org` and `www.dreamledger.org` returned HTTP 503 in the latest external check.
- `dreamledger-org.onrender.com` responded, but the MTG catalogue page showed a loading state. The static origin is therefore not yet fully verified.
- Render deployment attempts have failed with pipeline-minute exhaustion.
- A DNS cutover, Cloudflare Pages deployment, and independent restore test have not yet been verified.
- Verified revenue remains NZ$0.00 until the full economic completion chain has evidence.
