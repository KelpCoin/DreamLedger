# Honest distance to a minimal viable playable version

**Date:** 2026-09-19  
**Question answered:** How far away is the minimal viable playable version of PHINHAVEN / The Shallows?

## Short answer

**Not days. Not “almost done.”**  
With current repository evidence, the playable client/runtime is **missing**. What exists is:

- Design data for Floor 1 (The Shallows)
- Loop state machine
- Historical mentions of Supabase RPCs (`kelplantis_*`)
- Commercial / DreamLedger infrastructure (separate track)

There is **no discoverable `project.godot`, `.tscn`, or other executable game client** in KelpCoin/DreamLedger or KelpCoin/DreamLogic at the time of this write.

So the honest gap is:

| Layer | Status | Gap |
|-------|--------|-----|
| Floor 1 content data | Started (JSON) | Small — can expand offline |
| Loop / rules design | Started | Small |
| Authoritative backend RPCs | Documented historically | Unknown until live Supabase is inspected and bound |
| Playable client (Godot or other) | **Not present in repo** | **Large — must be recovered or built** |
| Multiplayer / netcode | Not in scope for MVP | Deferred |
| Cosmetics / tiers | Design only | Small once client exists |
| Monetization of play | Explicitly not claimed | Separate track |

## What “minimal viable playable” means here

A single player can:

1. Start in a sanctuary-like screen  
2. Enter **The Shallows**  
3. Move / explore (even grid or simple room)  
4. Gather Kelp Fronds and/or fight Tide Skitters  
5. Hit a clear condition **or** die  
6. See persistent progress (at least locally, ideally authoritative)  
7. See their linked avatar color/label if present  

That is the vertical slice. Not 100 floors. Not MMO. Not paid power.

## Realistic paths and distance

**Path A — Recover existing Godot / client**  
If a real project exists on a local machine, backup, or private branch:  
- Locate → import → reconcile with these data files → bind RPCs.  
- Distance after recovery: **days to a couple of weeks** of integration and polish for a rough playable slice (depends on how complete the old client is).

**Path B — No client exists; build minimal**  
- Smallest honest client: browser (HTML/Canvas or simple engine) or new Godot project from scratch using the data already written.  
- Distance: **multiple weeks** for a rough but real loop (move, gather, fight, clear/die, progress flag), longer if full Godot art/UX is required.

**Path C — Offline demo only (what this commit advances)**  
- A pure JS session simulator that walks the loop against the design JSON.  
- This is **not** the game product, but it proves the rules and is playable as a text/log demo today, fully air-gapped.

## What would move the needle fastest

1. Human locates or confirms the real client/runtime (or explicitly green-lights a minimal new client).  
2. Bind one enter-floor + one progress write path (even mock).  
3. Ship the smallest visible loop; expand content only after that survives a real play session.

Until (1) happens, further design data is useful but does not close the playable gap by itself.

## Boundary

Game activity remains **not** DreamLedger business revenue.
