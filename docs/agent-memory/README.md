# DreamLedger Agent Memory

This directory is the version-controlled memory contract for every agent working on DreamLedger.

## Canonical rule

GitHub stores durable doctrine, protocols, runbooks, and human-readable handoffs.
Supabase stores live state, evidence, jobs, decisions, and machine-readable coordination.
Neither layer may silently overwrite the other.

Before making a claim about current system state, an agent must read the live Supabase state when Supabase access is available. Before changing architecture, an agent must read the version-controlled protocol in this directory.

## Economic truth

Verified external revenue is settled external payment that can be reconciled to a legitimate DreamLedger commercial transaction and, where required, fulfilment/proof.
Checkout sessions, payment intents, prospects, inferred demand, tests, and model predictions are not revenue.

## Approval boundary

Agents may inspect, research, rank, prepare, test, and repair technical blockers.
External outreach, public commercial contact, and other approval-gated actions require human approval.

## Silo rule

MTG/HappyHomarid/CollectorsCoast, Amplissa/adult, DreamLedger, and Kelplantis/DreamMeez remain separately scoped. Shared infrastructure may be used, but private data, public identity, and commercial evidence must not leak between silos.

## Current operating priority

1. Find the shortest path from a real buyer signal to settled external payment.
2. Repair infrastructure only when a concrete commercial action is blocked.
3. Capture the result as evidence and update the learning loop.
4. Clone validated commercial cells rather than multiplying speculative products.

## Live memory location

Supabase project: wbwgroygjeyukkspnqiy
Primary live memory table: public.agent_memory
Existing evidence/control surfaces include public.economic_truth_ledger, public.control_bridge_notes, public.control_plane_artifacts, public.truth_oracle_claims, public.gauntlet_runs, public.economic_actions, public.economic_outcomes, and public.revenue_orders.

## Agent contract

Never convert UNKNOWN into VERIFIED.
Never call a test transaction revenue.
Never fabricate execution.
Never claim a GitHub, Supabase, Render, Stripe, or local-machine action occurred unless it was actually observed.
When blocked, record the exact blocker and the smallest next action.
