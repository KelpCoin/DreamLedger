# What exactly is being worked on right now

**Date:** 2026-09-19  
**Repo:** KelpCoin/DreamLedger (canonical)  
**Written to disk so operators can see progress without chat history.**

## Current focus (this session)

**Game work on PHINHAVEN Floor 1 — "The Shallows".**

Specifically:

1. **Content data for The Shallows** (pure JSON, no runtime required)
   - Enemy family definition
   - Resource node definition
   - Clear condition rules
   - Spawn / density hints for a first vertical slice

2. **Floor loop state machine** (authoritative-style states the client and server would share)
   - ENTER → EXPLORE → ENCOUNTER → RESOLVE → CLEAR or DEATH → WORLD_RESPONSE
   - Designed so it can later bind to existing `kelplantis_*` RPCs without inventing power or currency

3. **Continuity with prior notes**
   - Own-only linked avatar appearance (still defensive jsonb)
   - Cosmetics from membership tiers remain non-power
   - No claim that a Godot project is present in this repo yet

## What is NOT being worked on right now

- Live Stripe payments or revenue claims
- Auto-trading / live TCG execution
- Floor 2+ content
- Inventing a fixed appearance schema as if it were already in production
- Claiming the game is playable or monetized

## Boundary (unchanged)

Kelplantis / PHINHAVEN game activity is **not** DreamLedger business revenue. Stripe, real customers, and RA_000001 remain a separate track.

## Artifacts produced in this commit

- `PROOF/airgap/the_shallows_encounters.json` — enemy, resource, clear rules
- `PROOF/airgap/the_shallows_loop_states.json` — floor loop state machine
- This status file

## Why this shape

The master operating contract still marks PHINHAVEN as blocked pending canonical runtime recovery. Until a real Godot (or other) client is located and reconciled, the honest work is:

- freeze Floor 1 content as data,
- freeze the loop states,
- keep appearance and entitlements defensive,
- write everything to the repo so progress is visible on disk.

When the runtime appears, these files become the first integration targets instead of invented scope.
