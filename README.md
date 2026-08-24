# DreamLedger

DreamLedger is an independent commerce and digital-world verification surface.

The public product is intentionally small: structured offers, focused checkout surfaces, canonical item identity, and evidence-gated economic claims.

## Public principles

- Evidence before claims.
- A checkout surface is not proof of payment.
- A test fixture is never treated as real economic evidence.
- Canonical items are defined once and may be presented by multiple compatible experiences.
- Avatar and game surfaces reference the same canonical item identity rather than creating duplicate item records.
- Private implementation details, credentials, customer data, internal controls, and unpublished operational material are not part of the public product surface.

## Commercial control plane

- Public commerce surface: https://dreamledger.org
- Brand / holding surface: https://amplissa.com
- Canonical repository: https://github.com/KelpCoin/DreamLedger
- Current MTG NZ$29 checkout: https://buy.stripe.com/9B6aEX5DvdSd4Q73gwdwc1V
- Permanent QR policy: `IP/QR/QR-DESTINATION.txt`
- Markets: `MARKETS/MARKET-MATRIX.md`
- Social distribution: `SOCIAL/SOCIAL-VIRALITY-PLAYBOOK.md`
- IP custody: `IP/MASTER-IP-MAP.md` and `IP/PUBLIC-IP-MANIFEST.md`
- Execution architecture: `CONTROL-PLANE/COMMERCIAL-INTEGRATION.md`

Domain presence is not deployment proof. Payment is not claimed until external payment evidence exists.

## Execution spine

The system now has one explicit economic spine:

`Signal -> qualification -> approved response -> offer -> checkout -> external payment evidence -> verified revenue -> fulfilment -> learning -> winner candidate`

MTG is the first controlled commercial laboratory. The $29 Commander Deck Diagnostic is the first armed offer.

When the Windows GPU is available, LM Studio is the preferred local refinement plane. The iterative contract is proposer -> critic -> synthesizer -> Gauntlet -> proof.

When the PC is off, GitHub Actions provides deterministic continuity for compile, integration verification, Gauntlet, packaging, and settlement reconciliation. Cloud refinement is optional. Settlement reconciliation does not depend on an LLM.

Social publication, irreversible production changes, and other public commercial actions remain approval-gated. Automation cannot manufacture revenue, customers, traffic, testimonials, publication, or payment evidence.

## Live settlement spine

GitHub Actions is now the primary deterministic settlement reconciliation node for the first Revenue Atom.

`Stripe live Checkout Session -> GitHub Actions -> Airtable Economic Events -> proof artifact`

The workflow is `.github/workflows/commerce-settlement-sync.yml` and the implementation is `ops/commerce/reconcile-stripe-airtable.mjs`.

The workflow accepts only a completed, paid NZ$29 NZD Checkout Session associated with the configured live Stripe Payment Link. It is idempotent on the Checkout Session ID and writes verified economic events to Airtable only after external Stripe evidence exists.

Airtable remains the operational index. Stripe remains settlement authority. GitHub Actions is orchestration, not an authority for money.

## Production convergence

The Render deployment gate is configured to compile the canonical BEC-PRIME public surface, verify the approved Commander Deck Diagnostic offer, deploy the exact release SHA, and then verify the live `dreamledger.org` routes and production SHA.

The current external production check shows a convergence mismatch: `dreamledger.org` is serving an Agentic Sovereignty Diagnostic surface while the canonical GitHub deployment gate expects the MTG catalogue. This is treated as a deployment-state problem only. No revenue is asserted from it.

## 60-second verification

From `BEC-PRIME`:

`npm ci`

`npm run compile`

For settlement verification, manually run the GitHub Actions workflow `Commerce Settlement Sync` and inspect the uploaded `commerce-settlement-proof-{run_id}` artifact.

Expected pre-sale state is `verified_revenue_nzd: 0`. After a real live NZ$29 payment through the configured Commander Deck Diagnostic Payment Link, the artifact must contain a newly recognized `STRIPE-CHECKOUT-cs_...` event and `verified_revenue_nzd: 29`.

## Shared item model

The canonical item model lives under `item-schema/`.

An item declares its identity, kind, compatible experiences, and economic acquisition state. Presentation layers may project the canonical object for their own UI, but they do not become alternate sources of truth.

## Commerce verification

DreamLedger verifies commercial state independently of any single commerce platform. Public claims are limited to what can be supported by observable evidence.

A real payment is only considered verified after external payment evidence has been received and the economic proof chain has been generated from that evidence.

## Revenue truth

Current verified revenue remains NZ$0 until a real external payment is independently evidenced. CI, CD, QR generation, IP registration, market research, Gauntlet passes, and social-content generation do not alter that number.
