# DreamLedger

DreamLedger is the public economic and identity surface for the BrownEye/DreamLedger system.

The repository contains public surfaces, commerce rails, evidence/Truth Oracle components, MTG commerce, distribution tooling, and private/internal control-plane code. Confidential credentials and genuinely private business data must remain outside public source control.

## Current economic truth

Verified external revenue is tracked separately from infrastructure and intent.

Checkout starts, abandoned checkouts, payment links, database rows, tests, generated assets, and simulations are not revenue. Revenue requires an independently evidenced external payment, correct attribution, fulfillment, and proof.

## Own-first company operator

BEC-PRIME/OWN-FIRST-COMPANY-OPERATOR.json is the machine-readable operating contract for using the existing agents on DreamLedger itself before any white-label commercialization.

The intended loop is: reality -> asset mining -> intent qualification -> offer -> payment -> fulfillment -> proof -> distribution -> feedback -> clone.

## Canonical distribution

https://dreamledger.org/go is the canonical doorway. QR-CANONICAL-001 is the canonical QR identity. Distribution variants are measurable but external posting remains authorization-gated.

## Live machine-payment test

If you build agents, MCP tools, or paid APIs, DreamLedger has one deliberately small live commerce experiment: **TOLL-PROBE-50C, NZ$0.50**.

**Buyer job:** prove that a real payment can become a scoped machine capability and leave an attributable receipt.

**Flow:** discover → authorize payment → settlement → entitlement → scoped key → authenticated probe → receipt.

- Checkout: https://buy.stripe.com/6oU5kD4zrdSdciz3gwdwc3b
- Machine manifest: https://dreamledger-silo-gateway.onrender.com/api/toll/v1/manifest
- Buyer experiment: [GitHub issue #490](https://github.com/KelpCoin/DreamLedger/issues/490)

This is a live buyer experiment, not a revenue claim. Revenue remains zero until an independent settlement and fulfilled probe are evidenced.

## Security

The runtime includes deterministic agent and HTTP controls. Security work should follow OWASP ASVS and OWASP AI/agent security guidance. Internal RLS findings are tracked separately and must be remediated with explicit policies rather than blindly enabling RLS.

## Public production surface

Production serves compiled website artifacts from BEC-PRIME/compiled/website. Compiler changes are not sufficient unless the compiled artifacts are regenerated and deployed.



## Forensic fulfillment acceptance

The canonical fulfillment contract is [docs/FORENSIC-FULFILLMENT-ACCEPTANCE.md](docs/FORENSIC-FULFILLMENT-ACCEPTANCE.md). It enforces ten independent gates from observed opportunity through external action and keeps internal execution separate from fulfillment and verified economic truth. Repository CI validates this contract without changing the economic scoreboard.

## Universal pain research

The canonical universal-pain and B2B marketplace research corpus is maintained at [docs/UNIVERSAL-PAIN-OBSERVATORY.md](docs/UNIVERSAL-PAIN-OBSERVATORY.md) and extended by [docs/UNIVERSAL-PAIN-OBSERVATORY-P301-P400.md](docs/UNIVERSAL-PAIN-OBSERVATORY-P301-P400.md). The B2B transaction operating model is [docs/B2B-MARKETPLACE-TRANSACTION-OS.md](docs/B2B-MARKETPLACE-TRANSACTION-OS.md), with the public exchange at /b2b. Research remains separate from economic proof.

## FightEdge consolidation

FightEdge is a first-party DreamLedger service wall at [dreamledger.org/fightedge](https://dreamledger.org/fightedge/), served by the existing `dreamledger-org` Render static site. Its root-level route is mirrored under `public/` and CI keeps the two copies identical. The standalone Next.js deployment is compatibility-only and redirects Render-hosted URLs to the canonical route. No separate FightEdge ledger, queue, payment rail, Supabase project, or truth engine is permitted. See [docs/FIGHTEDGE-CONSOLIDATION.md](docs/FIGHTEDGE-CONSOLIDATION.md). CI enforces the route and deployment contract.
