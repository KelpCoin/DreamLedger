# The Shallows — minimal playable client shipped

**Date:** 2026-09-20  
**Path:** `phinhaven/shallows/index.html`  
**Commit purpose:** Move Floor 1 from design-only to a **playable browser vertical slice**.

## What you can play right now

Open `phinhaven/shallows/index.html` in any modern browser (local file or GitHub Pages if enabled).

- **Sanctuary** overlay → Enter The Shallows
- **Grid map** (12×12): water, sand paths, rocks, kelp nodes
- **Move:** WASD or arrow keys
- **Gather:** walk onto kelp → +1–2 Kelp Fronds
- **Fight:** walk into a Tide Skitter → turn-based resolve (you 3 dmg, skitter 2 dmg, skitter 8 HP)
- **Clear:** 6 fronds **or** 5 skitter kills
- **Death:** unbanked fronds lost; respawn at sanctuary overlay
- **Progress:** first clear stored in `localStorage` (not production authority)
- **Avatar:** teal circle (placeholder for linked appearance / primary_color later)

## What this is

- Honest **minimal viable playable loop** for Floor 1 content rules already defined in `PROOF/airgap/`.
- Air-gapped / local-first. No Stripe, no auto-trade, no server required.

## What this is not

- Not the recovered Godot production client (still not in repo).
- Not multiplayer.
- Not authoritative Supabase persistence (localStorage only).
- Not monetized. Game activity remains outside DreamLedger business revenue claims.

## Distance update

| Item | Before | Now |
|------|--------|-----|
| Design data | Yes | Yes |
| Clickable rules demo | Button log only | **Grid + move + gather + fight + clear** |
| Production Godot client | Missing | Still missing |
| Authoritative backend bind | Documented | Still not wired |

**Honest status:** There is now a **playable Floor 1 slice in the browser**. The production game client (Godot or equivalent) and live authority are still the remaining large gaps.

## Next integration targets (when runtime/backend available)

1. Replace local clear flag with `kelplantis_record_floor1_boss_clear` (or equivalent).
2. Fetch own appearance via proposed own-only RPC; tint player circle from `primary_color`.
3. Optional: host this path on Pages for shareable demo while Godot is recovered.

## How to run

```text
Open: phinhaven/shallows/index.html
```

Or from repo root after clone, open that file in Chrome/Firefox/Safari/Edge.
