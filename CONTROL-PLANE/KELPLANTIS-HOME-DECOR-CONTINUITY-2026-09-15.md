# Kelplantis home decor / Habbo direction — continuity

**Date:** 2026-09-15  
**Source:** Claude session (Supabase + client)  
**Grok stance:** discontinue game implementation; record only  
**Silo:** Kelplantis (isolated from DreamLedger revenue claims)

## Direction (operator framing)

Early inspirations: **Diablo / Faldon** + **Habbo Hotel**.

Honest gap from live code (Claude assessment):
- **Diablo-shaped:** town, dungeon, combat, loot, leveling — working and verified
- **Habbo-shaped:** thin — Home is a bare 4×4 with equipped-item pedestal dots
- Missing: room customization, decoration, personal expression
- Critical gap: **no multiplayer home-visiting**; presence works in town hub only, not in homes
- Habbo loop is *showing your room to others* — not built yet

Realistic path: bounded increments (not rewrite). Multiplayer plumbing (server-authoritative state, presence polling) exists; needs extension to homes.

## What Claude implemented / verified

### RPC: `kelplantis_set_home_decor`
- Validated against a **small real palette** (not free-text colors)
- Invalid color **rejected** (no state corruption)
- Valid decor applied correctly
- Message truncated to **60 chars**
- `anon` can call it (confirmed in session)
- Test data cleaned after verification

### Client (in progress in that session)
- Pull live source from Supabase (not local memory)
- Wall/floor swatches + message field
- Live palette render in home scene
- `lighten()` helper
- Dedicated **Decorate** panel (Home scene only; not overloading pedestal)
- Decorate button visibility gated by scene inside `render()`
- Integration tests extended for `kelplantis_set_home_decor`

## Still open

1. Finish client decorate UI + full integration test path if not fully merged
2. Surface room-modifier **names** in dungeon UI (prior note)
3. **Visitable homes** (multiplayer presence inside homes) — real Habbo loop
4. No monetization of decor until fulfilment/honest UX is solid

## Cross-plane write status

| Plane | Status |
|---|---|
| Supabase functions / notes | Claude session wrote live |
| GitHub CONTROL-PLANE | This file |
| Grok game code changes | **None** — discontinued per operator |

## Rule

Kelplantis remains silo-isolated. Game progress ≠ DreamLedger revenue. Claim must match mechanism (same integrity rule as room modifiers and commerce).
