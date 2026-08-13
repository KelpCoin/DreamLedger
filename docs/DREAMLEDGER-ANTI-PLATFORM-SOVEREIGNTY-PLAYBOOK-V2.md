# DreamLedger Anti-Platform Sovereignty Playbook v2.0

Date: 14 August 2026  
Live domain: dreamledger.org  
Repository: KelpCoin/DreamLedger  
Canonical product: Agentic Sovereignty Diagnostic - NZ$29  
Strategic position: independent merchant verification and portable proof.

## Part 0 - Thesis

DreamLedger is positioned as an independent verification layer for agentic commerce. The core economic object is the Fossil: an immutable, payment-bound, transaction-level proof that an offer was real, checkout worked, and money moved.

The strategic distinction is platform independence. Shopify UCP, Stripe Agentic Commerce Suite, x402, ACP, and AP2 may provide commerce rails or protocol capabilities, but DreamLedger's proof is intended to remain portable and merchant-owned rather than becoming a platform-owned trust badge.

The canonical chain is:

CANONICAL ITEM -> SKU / ASSET ID -> AVATAR + RPG PROJECTIONS -> PURCHASE -> DREAMLEDGER FOSSIL HASH -> acquisition_proof_ref -> OWNERSHIP / ANTI-DUPLICATION VERIFICATION

Adapters remain presentation layers. They must read the canonical object without creating ecosystem-specific copies. Economic proof resolution remains outside the adapters.

## Part 1 - Phase 0: First Payment

Objective: capture exactly one real payment and produce the first FIRST_PAYMENT_PROOF.json.

Product: Agentic Sovereignty Diagnostic - NZ$29.

Target buyers are independent merchants and consultants who value portable commerce data and are not dependent on a single platform. Initial outreach is one-to-one and private. No public launch is required.

Suggested private message:

> I built a $29 independent diagnostic that shows if your store is ready for AI agents without relying on Shopify, Google, or Stripe to verify you. You get a one-page checklist by email. Want to test it?

Primary checkout:

`https://buy.stripe.com/14A28r6G84lD1Ma9i36c00I`

After payment, capture payment ID, amount, currency, status, and available customer identifier. A manual fallback may be stored privately at:

`D:\BrownEyeCortex\BEC-PRIME\Proof\Manual\manual-payment-001.json`

Phase 0 is complete only when one real payment exists, proof evidence references it, the buyer receives delivery, and no unnecessary product work has been added.

## Part 2 - Phase 1: Proof Release

The first external proof artifact should contain evidence rather than a marketing claim.

Minimal structure:

```json
{
  "proof_version": "1.0",
  "proof_id": "fp_000001",
  "transaction_id": "pi_...",
  "amount_cents": 2900,
  "currency": "NZD",
  "status": "succeeded",
  "product": "Agentic Sovereignty Diagnostic",
  "payment_provider": "stripe",
  "webhook_verified": true,
  "ledger_event_id": "evt_000001",
  "ledger_head_hash": "sha256:...",
  "created_at": "2026-08-14T..."
}
```

Public proof should expose only non-sensitive evidence such as proof ID, transaction status, amount, product, date, hash, and verification explanation. Buyer identity, raw Stripe payloads, and secrets remain private.

Automated path:

1. Receive signed Stripe event.
2. Verify webhook signature.
3. Normalize the transaction.
4. Append the economic ledger event.
5. Generate the Fossil.
6. Publish the proof projection.
7. Let CI verify the artifact.

Replay protection must ensure one economic event cannot mint multiple Fossils. A deterministic identifier can be derived from the payment event, product identity, and ledger version. Duplicate event delivery must be idempotent.

Proof states should distinguish PAYMENT_VERIFIED, PROOF_GENERATED, LEDGER_APPENDED, PUBLIC_PROOF_LIVE, PAYMENT_FAILED, REFUNDED, DISPUTED, and REVOKED.

Phase 1 is complete when the proof exists, references a real transaction, verification succeeds or a documented manual fallback exists, duplicate events are harmless, and CI can return PASS/FAIL.

## Part 3 - Phase 2: Merchant Verification

Product: DreamLedger Independent Merchant Verification.

Value proposition: verify that a store can be discovered, understood, and purchased by AI agents while retaining portable evidence independent of a single commerce platform.

Verification checks include canonical product data, price correctness, checkout availability, payment-event capture, proof generation, ledger append, silo isolation, and an agent-readable surface.

Commercial tiers:

- Diagnostic: NZ$49 one-time.
- Independent Verification: NZ$149/month.
- Enterprise Verification: NZ$999/month.

Onboarding:

1. Merchant submits store or product URL.
2. Gauntlet runs deterministic checks.
3. Merchant receives pass/fail results.
4. Passing merchants enter the approval registry.
5. Checkout and proof integration are confirmed.
6. Merchant receives proof access and dashboard access.

Do not build an oversized enterprise console. The minimum dashboard is verification status, proof history, transaction count, silo assignment, API access, and billing state.

Phase 2 exits when 2-5 external merchants are onboarded, at least one third-party payment is verified, at least one merchant pays recurring verification revenue, and proof generation works for non-DreamLedger products.

## Part 4 - Phase 3: Anti-Platform Network

The Independent Verified Merchant Registry turns individual proofs into a queryable network.

An agent or buyer should be able to ask whether a merchant is verified and receive portable evidence such as merchant ID, verification state, last verified timestamp, applicable disputes, checkout health, and supported commerce surfaces.

Network flywheel:

More verified merchants -> more trustworthy inventory -> more agent queries -> more merchants seeking verification -> more proof history -> stronger trust graph.

Initial distribution should favor private merchant communities, independent commerce groups, multi-channel sellers, anti-lock-in communities, and direct relationships. Avoid paid acquisition until organic proof exists.

Geographic sequence: New Zealand, Australia, UK/Europe, then the US.

Phase 3 exits at 50 verified merchants, at least 10 third-party proof events, a live registry endpoint, one non-Shopify platform relationship, and recurring verification revenue that exceeds operating costs.

## Part 5 - Phase 4: Agent API and Trust Marketplace

Expose the canonical proof primitive through a stable API. Protocols are adapters, not canonical truth stores.

Core endpoints:

`POST /v1/verify`

`GET /v1/offers`

`POST /v1/checkout`

`GET /v1/proof/{transaction_id}`

Example verification response:

```json
{
  "verification": "PASS",
  "attestation_id": "...",
  "gauntlet_version": "...",
  "proof_required": true
}
```

Protocol boundary:

```text
UCP -----\\
ACP ------\\
AP2 -------> DreamLedger normalized proof
x402 -----/
Stripe ----/
```

The canonical proof remains stable while protocol adapters evolve independently.

Possible pricing includes pay-per-verification, volume agent tiers, and enterprise API access. Do not optimize pricing before real demand is observed.

Phase 4 exits when the API is documented, at least one external agent framework is integrated, verified merchants are queryable, per-verification revenue exists, and proof artifacts can be independently verified.

## Part 6 - Cross-Cutting Automation and Resilience

GitHub Actions should enforce proof and commerce invariants rather than merely build software.

Recommended gates:

- First-Sale Gate: health, offer, checkout, Stripe URL, and proof checks.
- Payment-Link Gate: validates the configured product and checkout surface.
- Proof Verification Gate: validates required fields, hashes, and replay resistance.
- Acquisition Proof Gate: validates canonical asset acquisition evidence.

Fallback hierarchy:

- If CI fails, manual verification remains possible.
- If Render fails, the payment link and manual delivery remain usable.
- If webhook delivery fails, reconciliation can use Stripe evidence or a secondary endpoint.
- If a payment rail fails, the event can be recorded as pending/manual evidence and reconciled later.

Evidence hierarchy:

`money > buyer response > executed proof > CI > deployed feature > architecture > market theory`

No lower-level artifact should be treated as stronger evidence than an unresolved higher-level artifact.

## Part 7 - Immediate Execution

The immediate sequence is intentionally small:

1. Send the NZ$29 diagnostic privately to one appropriate buyer.
2. Wait for payment.
3. If paid, capture the transaction evidence.
4. Generate FIRST_PAYMENT_PROOF.json.
5. Then automate public proof release and reconciliation.

No public launch, broad campaign, protocol integration spree, or second product is required before the first payment proof.

## Part 8 - Shared Asset / Economic Trust Bridge

The canonical item remains the single source of asset truth. Presentation adapters for Dreamiez and Kelp Atlantis consume that object without mutating or duplicating it.

The next acquisition-proof fixture should prove four states:

- valid Fossil -> ACCEPT
- missing Fossil -> NOT ACQUIRED
- wrong Fossil/item binding -> REJECT
- same acquisition proof claimed by incompatible owners -> REJECT

The adapter must never decide whether ownership is legitimate. It only transports the canonical item and its references. Economic proof resolution belongs in the trust/economic layer.

This gives one proof primitive multiple uses: commerce settlement evidence, ownership verification, anti-duplication, and cross-silo entitlement.

## Phase Gates

| Phase | Focus | Exit condition |
|---|---|---|
| 0 | First payment | FIRST_PAYMENT_PROOF.json exists |
| 1 | Proof release | Public proof projection is live |
| 2 | Merchant verification | 2-5 external merchants |
| 3 | Verified network | 50 verified merchants |
| 4 | Agent API | First external API verification |

## Operating Rule

DreamLedger is not required to defeat Shopify, Stripe, Google, x402, ACP, AP2, or any other platform. The strategic objective is narrower: make verification portable enough that merchants do not need to treat a platform's internal trust state as the only source of truth.

The product is proof. The platform is disposable. The canonical object is not.
