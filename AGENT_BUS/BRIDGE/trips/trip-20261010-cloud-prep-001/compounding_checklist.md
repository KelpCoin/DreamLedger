# Compounding Asset: Cloud-prep checklist for figure-eight trips

Reusable component produced by this preparation stage.

## What it is
A short, ordered checklist that any cloud agent can follow when preparing a non-MTG figure-eight test trip while a local LM Studio worker is offline.

## Why it compounds
It reduces repeated discovery work on every subsequent trip:
1. Confirm scope (non-MTG, zero external spend).
2. Select or draft one concrete candidate brief with the required fields.
3. Produce at least one reusable asset or explicit NO_REUSABLE_ASSET.
4. Write a valid round_trip_receipt.json (schema_version 1).
5. Leave a structured handoff in AGENT_BUS/BRIDGE/outbox/.
6. Keep revenue_claim = NONE / external_effect = NOT_ATTEMPTED until independent evidence exists.

## Path
This file itself is the asset. Future agents can copy or improve it.

## Limitation
It is documentation only; it does not execute local worker stages or create revenue.
