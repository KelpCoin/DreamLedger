# BEC-PRIME / DreamLedger: Sovereign Commerce Kernel

Status: FROZEN SPECIFICATION
Date: 2026-08-12
Classification: Internal - Solo Operator Handover

## Operating objective

The architecture is frozen. No further architecture expansion is required for the first-revenue experiment. The immediate objective is verified cash: a real buyer completes payment, the signed Stripe webhook is accepted, and the runtime writes FIRST_PAYMENT_PROOF.json.

## Core thesis

BEC-PRIME / DreamLedger is a compiler-driven, evidence-based commerce kernel designed to sit above payment and commerce protocols. Its central operating claim is that deterministic verification and durable transaction evidence should be treated as first-class commerce primitives.

Core loop:

DEMAND -> ELOHIM -> OFFER -> GAUNTLET -> CHECKOUT -> PAYMENT -> FOSSIL -> FULFILMENT -> CAPITAL -> COMPOUND

Five-layer spine:

1. Sensors: demand and friction signals.
2. Brain / Elohim: scoring, refinement, and deterministic gates.
3. Factory: product and offer compilation.
4. Commerce Spine: signal through payment and delivery.
5. DreamLedger: durable evidence and verification.

## Named primitives

### Browning Gauntlet

Deterministic hardening and verification before an economic signal or action is trusted. The working conceptual sequence is Atomize -> Attack -> Invert -> Rebuild.

### Fossils / Level 1 Evidence

A Fossil is a durable artifact generated from observed payment behavior. For the first-revenue flow, the canonical artifact is FIRST_PAYMENT_PROOF.json, created only after a valid Stripe checkout.session.completed event with payment_status=paid and valid webhook verification.

### CUBE

Cloneable, Universal, Boilerplate Engine. One canonical commerce implementation can be compiled into controlled silo-specific surfaces without mixing silo data or permissions.

## Current product ignition

SKU: COMMANDER-DECK-DIAGNOSTIC-001
Price: NZD 25.00
Status: published
Inventory: 999999
Approval required: false
Payment mode: Stripe Checkout
Checkout route: POST /api/offer-checkout/create
Webhook route: POST /webhook
Public base: https://dreamledger.org

The product is checkout-eligible but revenue remains unproven until a real buyer pays and the signed webhook produces FIRST_PAYMENT_PROOF.json.

## First-revenue roadmap

### Roadmap A: First Fossil

1. Verify production health and product availability.
2. Create a real Stripe Checkout session.
3. Give the resulting checkout URL to a real buyer.
4. Receive the successful payment webhook.
5. Verify FIRST_PAYMENT_PROOF.json.
6. Record the transaction as the first observed revenue event.

### Roadmap B: Productized service

Potential commercial ladder, to be tested against actual demand rather than treated as guaranteed pricing:

- Audit: NZD 250-500.
- Implementation: NZD 1,000-3,000.
- Engine deployment: NZD 5,000-15,000+.

### Roadmap C: Wealth loop

IP -> revenue -> retained capital -> productive assets -> compounding.

The economic rule is simple: sell the capability first, then productize repeated work, then let the commerce kernel consume its own proven workflows.

## Truth rules

The following do not count as revenue proof:

- successful GitHub build
- successful Render deployment
- passing smoke test
- generated Stripe Checkout session
- dashboard screenshot
- simulated webhook
- fabricated proof artifact

The following does count:

- real payment
- valid Stripe signature
- checkout.session.completed
- payment_status=paid
- transaction/session identifier recorded in the Fossil

## Public claims discipline

Market-size, protocol, competitor, and industry-lead claims in the wider strategic thesis are research hypotheses until independently verified against primary sources. This internal handover does not convert those claims into public facts. Public marketing must remain approval-gated.

## Architecture freeze

Do not add architecture merely to avoid the first sale. The next engineering work must be driven by a concrete production blocker, failed verification gate, buyer signal, payment event, or fulfilment requirement.

## Definition of done

BEC-PRIME / DreamLedger is not considered monetized until:

`data/proofs/FIRST_PAYMENT_PROOF.json`

exists in the production runtime's proof directory and contains a real Stripe transaction/session identifier from a successfully paid checkout.
