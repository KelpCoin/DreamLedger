# Godot client integration — exploration

**Date:** 2026-09-20  
**Canonical repo:** KelpCoin/DreamLedger  
**Related:** PHINHAVEN_RECON_V0.1.json, PHINHAVEN_MASTER_OPERATING_CONTRACT.md, phinhaven/shallows/ (browser MVP)

## 1. Recon result (verified again)

| Search target | Result |
|---------------|--------|
| `project.godot` in KelpCoin/* | **Not found** |
| `.tscn` / `.gd` / GDScript | **Not found** |
| BrownEye-CUBE (private) | No Godot files at top level; no code hits |
| DreamLogic / DreamLedger | Design data + browser client only |

**Conclusion:** There is still **no recoverable Godot client in GitHub**. Integration cannot mean “wire existing scenes”; it means **import or create**, then bind to existing design + (later) Supabase RPCs.

Historical recon (`PHINHAVEN_RECON_V0.1.json`) status remains correct: `godot_project: MISSING`, next gate = canonical runtime recovery or import.

## 2. What already exists to integrate *against*

| Asset | Location | Role for Godot |
|-------|----------|----------------|
| Floor 1 content | `PROOF/airgap/the_shallows_encounters.json` | Enemy/resource/clear numbers |
| Loop states | `PROOF/airgap/the_shallows_loop_states.json` | State machine / authority rules |
| Browser MVP | `phinhaven/shallows/index.html` | Reference behaviour (move, gather, fight, clear, death) |
| Documented RPCs | Floor vertical-slice docs | `kelplantis_enter_floor`, move, engage, attack, record clear, progress, world_state |
| Appearance intent | Prior PROOF notes | Own-only jsonb appearance; defensive `primary_color` |
| Entitlements design | `PROOF/airgap/phinhaven_tier_entitlement_schema.sql` | Cosmetics only |

Godot should treat the **browser client as the behavioural spec** for the first slice, not as competition.

## 3. Integration architecture (recommended)

```
┌─────────────────────────────────────────┐
│  Godot client (presentation + input)    │
│  - Sanctuary scene                      │
│  - The Shallows scene (grid or tilemap) │
│  - Player controller                    │
│  - Local prediction only where safe     │
└─────────────────┬───────────────────────┘
                  │ HTTPS / Supabase client
                  │ (anon key only in client)
┌─────────────────▼───────────────────────┐
│  Authoritative layer (Supabase RPCs)    │
│  - enter_floor / move / engage / attack │
│  - record clear / get progress          │
│  - own appearance / entitlements        │
└─────────────────────────────────────────┘
```

**Authority rules (from master contract):**

- Client: input, intent, presentation  
- Server: combat outcome, inventory, clear, progress, world flags  
- Never `@rpc("any_peer")` for gameplay authority  
- Identical `@rpc` signatures on all peers if multiplayer is added later  

For **MVP single-player offline / local-first**: Godot can mirror the browser loop fully offline, then swap gather/fight/clear to RPC calls when backend is bound.

## 4. Godot version and project layout

**Target:** Godot **4.2+** (4.x stable).  
Scaffold added under:

```text
phinhaven/godot/shallows/
  project.godot
  README.md
  scenes/
    sanctuary.tscn          (stub description in README if binary-unfriendly)
  scripts/
    game_state.gd
    shallows_controller.gd
    content_loader.gd
  data/
    the_shallows_encounters.json   (copy of design numbers)
```

Note: GitHub stores text; `.tscn` can be text-format in Godot 4. Scaffold uses **scripts + JSON + project.godot** so the project opens and runs a minimal main loop even before full scenes are drawn in the editor.

## 5. Binding map (browser → Godot → RPC)

| Browser MVP | Godot | Future RPC |
|-------------|-------|------------|
| Enter button | `enter_shallows()` | `kelplantis_enter_floor` |
| WASD grid move | `try_move(dx,dy)` | `kelplantis_move_player` |
| Walk on kelp | `gather_at(cell)` | harvest / inventory RPC |
| Walk on skitter | `engage(cell)` | `kelplantis_engage_encounter` + `kelplantis_attack` |
| 6 fronds / 5 kills | `check_clear()` | `kelplantis_record_floor1_boss_clear` |
| localStorage clear | `GameState.ever_cleared` | `kelplantis_get_floor_progress` / world_state |
| Avatar color | `Player.modulate` | own appearance RPC → `primary_color` |

## 6. Multiplayer (later, not MVP)

Do **not** block Floor 1 MVP on netcode. When added:

- Server-authoritative movement validation and combat  
- Same script → same `@rpc` signatures on every peer  
- Appearance: only own cosmetic fetch on client; others receive server-approved public cosmetic ids only  

## 7. Practical path to “Godot playable”

1. **Install Godot 4.x** on a PC (required for editor; cloud cannot replace local Godot edit).  
2. Open `phinhaven/godot/shallows/project.godot`.  
3. Run main scene / script entry; confirm loop matches browser rules.  
4. Build TileMap + sprites in editor (art is the main local work).  
5. When Supabase credentials and live RPCs exist: implement a thin `SupabaseClient` autoload and replace local clear/combat resolution one call at a time.  
6. Only then claim “canonical runtime recovered/imported.”

## 8. What this commit does / does not do

**Does:**  
- Re-verify missing Godot in org repos  
- Define integration architecture and binding map  
- Add a minimal Godot 4 project scaffold aligned with The Shallows data  

**Does not:**  
- Invent a fake full game already present in git  
- Claim multiplayer or live authority  
- Claim revenue  

## 9. Human gate

If a Godot project exists only on a local disk or old backup, **import it into this path** (or replace the scaffold) and update `PHINHAVEN_RECON` status. Until that import or a green-lit new client is real, the browser MVP remains the only fully playable slice in-repo.
