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

## Security

The runtime includes deterministic agent and HTTP controls. Security work should follow OWASP ASVS and OWASP AI/agent security guidance. Internal RLS findings are tracked separately and must be remediated with explicit policies rather than blindly enabling RLS.

## Public production surface

Production serves compiled website artifacts from BEC-PRIME/compiled/website. Compiler changes are not sufficient unless the compiled artifacts are regenerated and deployed.
