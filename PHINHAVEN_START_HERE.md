# PHINHAVEN: START HERE

This is the operator-facing status page.

## What is already working conceptually

DreamLedger has a canonical GitHub repository, Supabase migrations, deployment configuration, commercial pages, proof artifacts and a repaired Stripe settlement path. The latest Stripe repair commit explicitly accepts `payment_intent.succeeded` and recovers Checkout Session attribution.

## What is not yet true

PHINHAVEN is not yet a verified playable commercial product.

The canonical repository currently has no discoverable `project.godot` or PHINHAVEN Godot runtime. Kelplantis-era database work is present, but database work alone does not prove a playable client/server game.

Therefore: do not expect PHINHAVEN money yet.

## What the user needs to do

For ordinary hosted commerce and website operation: nothing, once the relevant cloud services are deployed and verified.

For local development: the PC must be on.

For local LM Studio/Ollama workers or local bridge processes: the PC must be on.

For a fully cloud-running PHINHAVEN runtime: the game server/build pipeline still has to be implemented and deployed. That is not currently proven.

## What the system does automatically after the gates are genuinely closed

Customer checkout -> Stripe settlement -> webhook verification -> idempotent payment recording -> entitlement -> fulfillment -> proof -> reconciliation.

GitHub/CI can handle repository-driven builds and deployment where workflows and secrets are configured.

Supabase can hold authoritative data, evidence and reconciliation state.

The PC does not need to be the production server.

## The one thing automation cannot do

It cannot guarantee a buyer exists.

A sale becomes verified only when a real external customer pays and the payment, attribution, entitlement, fulfillment and evidence chain closes.

## Current next action

FIN-PHIN-RECON-001

Recover or locate the actual PHINHAVEN Godot project, establish it as canonical, and reconcile it before writing new game systems.

## Commercial sequence

GAME PROOF -> PURCHASE PROOF -> REPEATABILITY -> SCALE

Not:

BUILD EVERYTHING -> HOPE -> ADVERTISE

## Status vocabulary

VERIFIED = evidence closes the required chain.
UNVERIFIED = implementation exists but evidence is incomplete.
BLOCKED = required dependency is absent or contradictory.
TEST = controlled test activity.
SIMULATED = simulation only.
UNMATCHED = external event cannot yet be attributed safely.
STALE = evidence no longer represents current state.

Never promote TEST or SIMULATED activity into revenue.
