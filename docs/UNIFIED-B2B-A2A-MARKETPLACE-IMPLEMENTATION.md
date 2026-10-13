# Unified DreamLedger B2B + A2A Marketplace

**Status:** implementation branch, not yet merged, migrated, deployed, or proven end-to-end in production. The code deliberately reports blocked persistence and checkout instead of claiming a working market when the database or payout path is not ready.

## Product scope

One transaction kernel supports fixed-price goods and services, timed auctions with reserve prices and anti-sniping, procurement RFQs, supplier offers, agent capabilities, evidence, order authorization, settlement, delivery, buyer acceptance, disputes, and the CUBE hypothesis swarm.

Human and agent traffic share the same transaction records and ledger. An agent can discover, propose and request authorization. It cannot spend or perform irreversible actions solely because it generated an intent.

## Transaction state and economic truth

`OBSERVED → QUALIFIED_BUYER_INTENT → AUTHORIZED → PAYMENT_PENDING → SETTLED → FULFILLED → DELIVERED → ACCEPTED → VERIFIED`

These states are not interchangeable. The system records a claim only when the corresponding event and evidence exist. A listing, RFQ, agent intent, Checkout Session, order row, CI pass, or internal ledger event is not revenue.

The PostgreSQL ledger uses idempotency keys, sequence IDs, previous hashes, event hashes and a webhook inbox keyed by (provider, event_id). Settlement checks the paid Checkout Session's order reference, amount and currency inside the same transaction that records the event. Delivery is rejected until payment is settled and requires evidence IDs. Buyer acceptance is a separate event.

## Implemented surfaces and routes

- `GET /api/marketplace/v1/discovery`: machine-readable unified capability contract.
- `GET /api/marketplace/v1/status`: selected persistence backend health.
- `GET /api/marketplace/v1/listings?q=...`: published listings only.
- `GET /api/marketplace/v1/auctions`: reviewed, live/scheduled timed auctions.
- `POST /api/marketplace/v1/listings/{listing_id}/auction`: supplier submits a timed-auction schedule for review.
- `POST /api/marketplace/v1/auctions/{auction_id}/bids`: buyer credential with `place_bid` scope and explicit human confirmation; enforces minimum increments, no seller self-bids, reserve, and anti-sniping.
- `POST /api/marketplace/v1/admin/auctions/{auction_id}/close`: admin-gated closeout after the end time; creates an unpaid winner order only when the reserve is met.
- `POST /api/marketplace/v1/rfqs`: public RFQ intake with a honeypot, size limits, rate limit, idempotency key and OBSERVED state.
- `POST /api/marketplace/v1/listings`: authenticated supplier listing submission; starts in pending_review.
- `POST /api/marketplace/v1/rfqs/{rfq_id}/offers`: authenticated supplier response to an open RFQ.
- `POST /api/marketplace/v1/offers/{offer_id}/accept`: buyer-authenticated, explicit human authorization; creates an unpaid order.
- `POST /api/marketplace/v1/evidence`: registers a content hash and provenance as UNVERIFIED.
- `POST /api/marketplace/v1/orders/{order_id}/checkout`: creates a Stripe Connect destination-charge Checkout Session only after explicit feature flags and seller readiness gates pass.
- `POST /api/marketplace/v1/orders/{order_id}/delivery`: seller submits delivery manifest and evidence IDs; settlement is required first.
- `POST /api/marketplace/v1/orders/{order_id}/acceptance`: buyer accepts delivery or records a dispute state.
- `POST /api/marketplace/v1/admin/parties/{party_id}/connect-onboarding`: admin-gated Stripe-hosted seller onboarding.
- `POST /api/marketplace/v1/admin/credentials`: admin issues a role- and scope-bound API token once; only its SHA-256 digest is stored.
- `POST /api/marketplace/v1/admin/credentials/{credential_id}/revoke`: revoke a credential.
- `GET /api/marketplace/v1/ledger`: audit-token protected ledger view.

`/b2b`, `/a2a`, and `/marketplace.html` now point to the same human + machine commerce surface. The public page fetches real API data and explicitly says when the ledger is unavailable; it does not fabricate listings.

## Persistence choices

### Supabase (default)

The selected backend is `MARKETPLACE_STORE=supabase`. The service uses Supabase REST/RPC calls with bounded timeouts. It does not reuse a serverless postgres-js connection pool. If the RPC preflight fails, writes fail closed. No silent local fallback and no split brain.

The SQL files under `supabase/migrations/20261013000*.sql` define the transaction schema, RLS, idempotent RFQ/agent flows, transaction lifecycle RPCs, Stripe Connect readiness, credentials and the 36-candidate CUBE seed. They have **not** been applied to the production project from this branch. First apply and test them in a disposable/staging Supabase project; inspect existing tables and constraints before production migration.

### Encrypted local fallback

Set `MARKETPLACE_STORE=local`, configure `MARKETPLACE_LEDGER_PATH` on a mounted persistent disk, and inject `MARKETPLACE_LOCAL_ENCRYPTION_KEY` as a secret containing exactly 64 hex characters (32 random bytes). The local event journal uses AES-256-GCM, fsync, a SHA-256 hash chain, and verifies the chain on read.

Local mode is a single-writer fallback, not a distributed database. It is unsuitable for multiple replicas and does not claim external payment settlement. Do not run Supabase and local as simultaneous writers. Back up the encrypted journal and its key separately. Notion is not the ledger because it cannot provide the required atomic settlement/idempotency transaction semantics.

## Credential configuration

Dynamic credentials are stored as SHA-256 hashes in `marketplace_api_credentials`, with role, scopes, party, optional expiry, and agent principal. The raw `dlm_` token is returned once by the admin endpoint. Keep `MARKETPLACE_ADMIN_TOKEN` private. A credential is not a verified identity by itself.

## Stripe Connect gate

Checkout requires all of the following:
- `MARKETPLACE_ENABLE_CHECKOUT=true`
- `MARKETPLACE_PAYOUT_MODEL=stripe_connect_verified`
- `MARKETPLACE_STORE=supabase`
- configured `STRIPE_SECRET_KEY` and verified webhook signing secret
- seller's Stripe account has `charges_enabled`, `payouts_enabled`, and `details_submitted` confirmed by a signed `account.updated` event
- order, currency, amount and session reference match during settlement.

The 5% application fee is encoded as the initial platform fee hypothesis and must be reviewed for legal, tax, refund, dispute, and seller terms before production enablement. The Connect onboarding endpoint is itself disabled until `MARKETPLACE_ENABLE_CONNECT_ONBOARDING=true`. Do not enable either flag until staging proves onboarding, payment, transfer, refund, dispute and reconciliation end-to-end.

## CUBE swarm

`data/777/cube-b2b-sales-hypotheses.v1.json` contains 36 hypotheses: 14 P1, 18 P2 and 4 P3. They are internal candidates, all `HYPOTHESIS_UNVALIDATED`. Migration `202610130003_seed_cube_b2b_hypotheses.sql` inserts them into `marketplace_cube_hypotheses` without overwriting entries that have advanced beyond the unvalidated state.

A hypothesis becomes qualified only with a traceable external buyer, a current concrete problem and explicit solution/vendor/tool intent (or an actual submitted RFQ). Generic news, generated pages, page views, internal agents, and speculative supplier availability do not qualify. Each silo must pass its readiness gates and one-CTA rule.

## Release order

1. Run CI syntax and contract checks.
2. Apply migrations to a disposable staging project; inspect actual constraints and run concurrency/idempotency tests.
3. Test local encrypted journal with a temporary key and persistent-volume simulation; verify tamper detection.
4. Create a staging buyer and seller; run listing review, RFQ, offer, human acceptance, Connect onboarding, Checkout, signed settlement webhook, duplicate webhook replay, delivery evidence, buyer acceptance and refund/dispute paths.
5. Prove duplicate webhook replay yields one settlement and one order state transition.
6. Reconcile Stripe balance/transfer data against the ledger and delivered evidence.
7. Only then approve production migration/deployment and turn on checkout flags.

Current economic scoreboard from this code change: 0 new qualified external buyer intents, 0 new independent buyers, 0 settled payments, 0 verified revenue. This is a concrete implementation contribution, not a claim that the market is already operating.
