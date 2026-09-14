# Kelplantis room-modifier mechanics — continuity note

**Date:** 2026-09-15  
**Source session:** Claude (Supabase live functions)  
**Status:** mechanics verified; UI name surfacing still open  
**Authority:** subordinate to BECK operating contract (no revenue claimed)

## Problem

Room modifiers built on the content-bank layer had **display text that claimed mechanical effects without implementation** — the same "flavor text as false claim" failure mode the project guards against.

| Modifier | Claimed effect | Actual before fix |
|---|---|---|
| `mossy_floor` | Referenced nonexistent "AP" system | Text only |
| `root_tangle` | Damage reduction | Text only |
| `fungal_glow` | Healing boost | Text only (default +2 path) |

## Fix (live Supabase)

Implemented real mechanics in **database functions** (not a client download):

- `fungal_glow` recovery verified: HP 1 → 4 (**+3**, not old default +2)
- Damage path under reduction modifier capped correctly in live combat checks
- `mossy_floor` no longer claims a nonexistent AP system
- Test data cleaned; `soul_events` FK deletion path handled cleanly

Claude also wrote continuity into Supabase `control_bridge_notes`.

## Still open (safe, client-only)

Room-modifier **names** ("Root Tangle", "Echoing Hall", "Fungal Glow", etc.) are **not yet shown in the dungeon UI**. Mechanics are real; players may not know *why* a room feels different.

**Next small step:** surface modifier name (and short honest effect line) on the room UI — client-only, no economy claim.

## Cross-agent rule

- Mechanics truth lives in **Supabase functions** for this silo.
- GitHub holds this continuity note so Grok/Claude/other sessions do not re-derive or re-break the claim/code match.
- Kelplantis remains **silo-isolated**; no DreamLedger revenue inference from game modifiers.

## Integration with Grok↔BECK membrane

- OBSERVE: modifier claims must match live combat math
- RECORD: this file + Supabase `control_bridge_notes`
- Do not scale cosmetics/monetization of modifiers until UI honesty is complete and any paid path has its own fulfilment contract
