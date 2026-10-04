# DreamLedger Factory Factory

This directory is the executable economic-cell control plane. It is deliberately additive and does not replace existing production settlement code.

## First generated silo

Happy Home Road / MTG is the first generated economic silo.

The compiler consumes economic-cell JSON contracts and emits an execution plan. External effects remain authority-gated. No generated artifact is revenue.

## Runtime rails

- Human settlement: existing Stripe rail.
- Agent settlement: x402 adapter contract, disabled until wallet/facilitator credentials are provisioned.
- DOOH: Trillboards adapter contract.
- Avatar: Ready Player Me adapter contract.
- Commerce: agent-facing catalog and checkout contract.
- Proof: OBSERVED / INFERRED / VERIFIED state machine.

## Local/cloud invariant

The same cell contract hash is intended to be stored in GitHub, Supabase factory_instances, and the local BrownEye data lake. Divergence is a verification failure.
