# Kelplantis Floor 1 + Economic Event Graph Implementation

STATUS: IMPLEMENTED_FOUNDATION
DATE: 2026-09-08

## Boundary

This change does not claim a completed MMO client, multiplayer infrastructure, production payment validation, or RA_000001. It establishes the durable event-graph substrate and task execution hardening required to connect observed game/economic events to later pattern detection and calibrated prediction.

## Event flow

RAW EVENT -> NORMALIZE -> GRAPH RELATIONSHIP -> MOTIF -> PREDICTION -> CALIBRATION -> ELOHIM PROPOSAL -> TRUTH ORACLE -> GAUNTLET -> ADMISSION -> ACTION -> OUTCOME -> LEARNING

Prediction never grants authority. Predictive dependency is not causal evidence.

## Canonical event stream

public.normalized_events retains:

- source_system
- raw_event_id
- event_type
- actor/target/location dimensions
- occurred_at
- session context
- original metadata
- category
- economic relevance
- evidence hash
- optional predecessor

A unique source_system/raw_event_id key makes ingestion replay-safe.

## Graph structures

public.event_relationships stores temporal/statistical relationships and explicitly distinguishes predictive dependency from causal claims.

public.event_motifs stores recurring event sequences, frequency, recency, confidence, economic relevance, score and decay parameters.

public.economic_predictions remains the prediction lifecycle store. Existing schema is preserved; indexes now support status/window and motif lookup.

## Ingestion

INSERT triggers normalize new kelplantis_events and economic_events automatically. Existing rows are backfilled idempotently into normalized_events.

## Execution resilience

public.claim_economic_model_task(task_id, lease_seconds) atomically claims a pending task or an expired running lease and increments attempt_count.

public.requeue_expired_economic_model_tasks() returns expired running tasks to pending and records a lease-expiry marker.

The existing unique idempotency_key constraint remains authoritative.

## Floor 1

The existing repository already contains a playable local Floor 1 runtime, deterministic dungeon generation, combat, loot, save/load, floor progression functions, boss-clear functions and world-state functions. The next client increment is to connect those existing primitives to the authoritative Supabase functions rather than duplicating them in browser localStorage.

The authoritative backend already exposes:

- kelplantis_create_player
- kelplantis_enter_floor
- kelplantis_move_player
- kelplantis_engage_encounter
- kelplantis_attack
- kelplantis_record_floor1_boss_clear
- kelplantis_apply_floor1_first_clear
- kelplantis_get_floor_gate
- kelplantis_get_floor_progress
- kelplantis_get_world_state
- kelplantis_list_town_presence

## Security boundary

Do not expose a service-role key in the browser. Do not weaken RLS. Do not use synthetic records as real player or payment evidence.

## Remaining work

1. Connect the playable client to authenticated/authorized authoritative functions.
2. Add one or two authoritative visible world-state consequences to the Floor 1 player loop.
3. Build motif extraction and relationship estimation from normalized_events.
4. Generate calibrated predictions only from evidence-bearing patterns.
5. Feed predictions into Elohim as proposals only.
6. Preserve Truth Oracle, Gauntlet, admission and human approval boundaries.
7. Independently verify a real stranger payment before RA_000001 can close.
