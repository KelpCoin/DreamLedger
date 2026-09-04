# BECK Kingdom Commissioning Ledger

Date: 2026-09-04
Repository: KelpCoin/DreamLedger
Canonical branch: main

## Purpose
This file is the compact operator ledger for BrownEye Cortex commissioning. It records machine-verifiable state without claiming revenue or production convergence that has not been evidenced.

## Green by repository evidence
- Canonical Cortex production spine workflow exists and runs on Node 24.
- Silo, commercial integration, production contract, front door, revenue ledger, autonomy, runtime, and Stage 1 proof checks are wired into the production spine.
- Stage 1 is explicitly simulation-only and cannot authorize RA_000001.
- Economic Loop Controller reconciles live Stripe evidence before fulfillment.
- Fulfillment work is generated only from newly recognized verified payment events.
- Public posting remains disabled in the economic proof path.
- Render deployment repair logic is part of the production heartbeat path.
- The repository has a canonical production nucleus and explicit economic blocker.

## Remaining commissioning blockers
1. Production `/version` must converge to the current `main` SHA.
2. The public-surface guard must be aligned with the current storefront contract.
3. A genuine external paid Stripe Checkout Session must be reconciled. Until then verified revenue remains NZ$0 and RA_000001 is not authorized.

## Human-only actions
- Enter or rotate GitHub Actions secrets and variables.
- Make or approve a real customer purchase.
- Approve consequential public, financial, or irreversible actions.

## 60-second verification
Open Actions in GitHub and inspect the latest `Cortex Production Spine` run. For the economic gate, inspect the latest `Economic Loop Controller` run and its `Reconcile live payment evidence` step.

## Proof contract
No synthetic payment, traffic, checkout intent, or health signal counts as revenue. Evidence files must come from runtime execution.
