# Kelphaven.n: B2B + A2A marketplace implementation contract

**Status: FOUNDATION CONTRACT ONLY. Not production-ready, not deployed, and not a claim of full Trade Me replacement.**

Kelphaven.n is the canonical marketplace name for this work. Do not rename it to Kelplantis or any other spelling. MTG remains the master silo/reference implementation for catalogue and evidence quality. Silo isolation remains mandatory, including the existing MTG/HappyHomarid/CollectorsCoast versus Amplissa/adult boundary.

## Customer-facing truth at the current checkpoint

The live site is not yet demonstrably enterprise-grade end-to-end. A successful static page load or Stripe checkout URL is not proof of order fulfilment, durable entitlement, seller payouts, refund handling, dispute handling, or a finished marketplace. Prior recorded evidence includes public routes returning 503, a disabled billboard payment link, mismatched canonical QR destinations, and a game access SKU without proven full playable-loop acceptance. These are release blockers, not cosmetic TODOs.

Do not display a product as buyable unless the current catalogue, checkout state, price/currency, availability, and fulfilment contract agree. Do not display an order as complete until the settlement event and retrievable delivery receipt reconcile.

## Automated product creation and pricing

1. Elohim may draft a listing and propose a price from explicit evidence.
2. The proposal must include seller/silo identity, currency, unit cost, transaction costs, fulfilment costs, tax treatment, timestamped source evidence, and the pricing policy version.
3. A missing cost or source must produce a held proposal, not a guessed price. Price comparison evidence must identify source, time, region, condition, shipping, and tax basis where applicable.
4. The Gauntlet independently checks evidence shape, margin floor, seller verification, silo boundaries, policy, checkout, and fulfilment proof. A model cannot mark its own proposal as independently verified.
5. A Gauntlet PASS means eligible for human review, not published. Human approval remains required for public listing and irreversible external actions.
6. Any price change creates a versioned proposal. Existing orders retain the accepted price. Never rewrite historical order economics.
7. Dynamic price experiments must be bounded, explainable, auditable, and reversible. No discriminatory or opaque individual pricing; no false scarcity; no fabricated competitor quotes.

The initial deterministic kernel and Elohim-to-Gauntlet product pipeline live at BEC-PRIME/commerce/kelphaven-marketplace-contract.mjs and BEC-PRIME/commerce/kelphaven-elohim-product-pipeline.mjs. The latter is called for Elohim marketplace-product proposals, calculates a cost-plus price only when source/timestamp/kind/SHA-256 evidence is supplied, runs the existing CandidateGauntlet, and emits an unpublished draft. The evidence SHA proves payload integrity metadata only, not the truth of market facts. These modules do not constitute a persistence layer, provider adapter or production deployment.

## Elohim price creation and Gauntlet decision\n\nWhen an Elohim proposal is tagged `kind: "marketplace_product"` or supplies `product_candidate`, `ElohimV6.propose` now calls the pricing pipeline before it writes its proposal proof. Without timestamped, source-referenced, hashed price evidence and valid cost inputs, the candidate is held without a default price. A Gauntlet PASS produces `READY_FOR_HUMAN_REVIEW`, never PUBLISHED. Checkout stays disabled and both `may_publish` and `may_charge` remain false. The CandidateGauntlet checks payload shape, manifest hash, policy identity and price/cost floor; it does not independently fetch or authenticate the source data.\n\n## B2B and agent-to-agent trade lifecycle

Both human B2B trades and A2A trades use the same economic state machine:

INTENT -> OFFER_ACCEPTED -> PAYMENT_PENDING -> PAID_VERIFIED -> FULFILLMENT_PENDING -> DELIVERED

Exceptional states include DISPUTED, REFUNDED, and CANCELLED. Every transition must be idempotent and evidence-backed. An agent identity does not grant payment or seller privileges. Agents may discover, compare, negotiate within declared limits, and prepare orders; they cannot bypass seller verification, buyer consent, checkout confirmation, policy controls, or payment settlement.

Required records for a production implementation:
- tenant/silo identity and immutable tenant boundary;
- verified seller and payout onboarding status from the actual payment provider;
- product/listing version and evidence manifest;
- offer, quote, expiry, accepted price, currency and tax/shipping terms;
- buyer consent/agent delegation scope and spending limit;
- provider checkout/session and signed webhook event IDs;
- settlement reconciliation and refund/dispute status;
- fulfilment job, delivery receipt, recipient and timestamp;
- append-only economic ledger and reconciliation evidence;
- audit events, rate limits, abuse controls, idempotency keys and retention policy.

Never synthesize Stripe connected-account IDs or wallet addresses from hashes. Provider identities must be issued by the real provider; wallet addresses require real key management and a cryptographic derivation path. The marketplace must not custody private keys in application logs or prompts.

## Fees and commercial policy

A zero-GMV fee means zero platform revenue, not a free operating system. The marketplace may offer 0% GMV on the MTG reference silo only if this is the declared policy and the cost/revenue model supports it. All other silo fees must be explicit at listing and checkout. No hidden fees. Show seller net proceeds and buyer total before acceptance. Do not claim profitability without real costs, refunds, support load, payment fees, and settled order data.

## Release gates

A release is not accepted until all are proven against a deployed environment:
- customer journeys tested from phone-sized viewport through sign-up, browse, search/filter, listing creation, quote/offer, checkout, settlement, fulfilment, receipt, refund/dispute and support;
- access control/RLS and cross-tenant isolation tests pass using at least two real test tenants;
- signed webhook replay, duplicate delivery, out-of-order event and idempotency tests pass;
- price and fee totals reconcile exactly from listing through ledger and provider settlement;
- no unapproved product or test record leaks into public search;
- backups restore, migrations are reversible or have a documented recovery path, and alerts/ownership are configured;
- accessibility, performance, security, privacy, consumer-law and seller-policy checks pass;
- a production smoke test produces a retrievable evidence bundle with commit, deployment, route, order and fulfilment identifiers.

## Work sequence

1. Fix the current customer-facing broken routes and inconsistent offer/checkout state. Billboard stays held until a real active checkout plus inventory reservation and fulfilment path are proven.
2. Make MTG the golden-path reference: real catalogue data, condition/printing, stock and seller identity, NZD totals, checkout, settlement, fulfilment and receipts.
3. Implement seller onboarding, inventory, offers, quote/negotiation, messaging, shipping/collection, cancellation, refunds, disputes and reputation.
4. Implement tenant isolation and clone manifests only after MTG's end-to-end acceptance passes.
5. Add A2A agent discovery/negotiation/order placement behind explicit delegation, limits, policy evaluation, human escalation and audit.
6. Add automatic pricing as versioned proposals through Elohim and independent Gauntlet review; only then add controlled publication.
7. Add multi-silo expansion from the proven template. Do not mass-create empty tenant shells and count them as progress.

## Evidence status

- The contract module and unit tests are proposed in branch beck/kelphaven-b2b-a2a-marketplace-20261020.
- No production deployment, DNS change, payment mutation, external posting, or live seller onboarding was performed by this change.
- The full marketplace is not yet built or smoke-tested end-to-end. This file deliberately does not certify it as enterprise-grade.
- Revenue remains unverified until an independent buyer's settled payment, attribution, fulfilment and retrievable delivery proof reconcile.