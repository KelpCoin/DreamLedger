# PHINHAVEN · The Shallows — Godot 4 scaffold

Minimal **Godot 4.2+** project aligned with the browser MVP and design JSON.

## Open

1. Install [Godot 4.2+](https://godotengine.org/download)
2. Godot → **Import** → select this folder (`phinhaven/godot/shallows`)
3. Open and press **F5** (main scene: `scenes/main.tscn`)

## Controls

| Input | Action |
|-------|--------|
| Space / Enter | Enter floor from sanctuary |
| WASD / Arrows | Move on grid |
| Walk onto green circles | Gather Kelp Fronds |
| Walk onto brown circles | Fight Tide Skitter |

Clear: **6 fronds** or **5 kills**. Death loses unbanked fronds.

## Layout

```text
project.godot
scripts/game_state.gd          # autoload state + local save
scripts/shallows_controller.gd # grid, move, gather, fight, draw
scripts/content_loader.gd      # JSON loader
scenes/main.tscn
data/the_shallows_encounters.json
```

## Integration next steps

1. Replace `_draw` circles with TileMap + sprites in the editor.
2. Add `SupabaseClient` autoload; call live `kelplantis_*` RPCs for enter/move/combat/clear.
3. Tint player from own-only appearance `primary_color` when RPC exists.
4. Do not use client-side clear as production truth once backend is bound.

## Authority

This scaffold is **offline / local**. Production authority remains Supabase (or equivalent). See `PROOF/2026-09-20-GODOT-CLIENT-INTEGRATION-EXPLORE.md`.
