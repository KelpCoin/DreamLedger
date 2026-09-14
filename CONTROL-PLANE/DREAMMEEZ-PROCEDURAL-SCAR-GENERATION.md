# Procedural scar generation — DreamMeez face HUD

**Goal:** permanent + transient facial injury that is readable at 64–96px, story-backed (Fable / Lies of P), and honest to game state.

---

## Approaches (industry + practical)

### 1. Authored overlay atlas (best fit for your UI)
Pre-draw scar sprites (transparent PNGs) for fixed face regions. Composite on the base face tile.

| Pros | Cons |
|---|---|
| Perfect readability at HUD size | Finite variety |
| Cheap runtime | Art pass per scar |
| Easy permanent vs fresh variants | |

**Regions:** brow_l, brow_r, cheek_l, cheek_r, lip, nose_bridge, jaw, eye_orbit, chin.

### 2. Parametric stroke (true procedural 2D)
Generate a scar as a **polyline + width + healing age** on a face UV / 2D mask.

```
scar = {
  seed,
  region,           // enum
  path: [{x,y}…],   // normalized face space 0–1
  width_px,
  depth,            // 0 healed flat → 1 deep
  age: 0..1,        // 0 fresh red → 1 pale permanent
  style: keloid|atrophic|linear|burn
}
```

Rasterize: draw tapered line, optional noise along edge, color by `age`.

| Pros | Cons |
|---|---|
| Huge variety from seed | Can look messy at 64px if uncontrolled |
| Deterministic from `event_id` | Needs region constraints so scars stay on face |

### 3. Decal / stamp with noise
Place a scar stamp (S shape, slash, X) at a region anchor; warp with noise; multiply onto face.

Used heavily in 3D (Substance-style wound tools, geoshell scars). For 2D HUD: same idea on canvas.

### 4. 3D morph + texture (AAA)
Cyberpunk-style scar maps, ZBrush morphs (carved vs keloid), normal/roughness. Overkill for soft-pixel DreamMeez HUD; relevant later if 3D avatars ship.

### 5. ML face texture synthesis
Artist-conditioned generators for full face textures. Wrong layer for gameplay scars (ops cost, nondeterministic, hard to “grant scar from boss_3”).

---

## Recommended hybrid for DreamMeez

**Phase 1 — Atlas + state machine** (ship with Imagine prompts you already have)  
**Phase 2 — Seeded parametric scars** for rare event uniqueness  
**Never** — random scars with no event id (breaks Soul Tome story)

### Deterministic grant

```
grant_scar(player_id, event_id, region_hint?) →
  seed = hash(player_id + event_id + region)
  if atlas hit for (event_type, region): use authored frame
  else: parametric_stroke(seed, region, age=permanent)
  persist permanent_scars[]
```

Same player + same event → **same scar** forever (replay-safe, inspect-safe).

### Age / healing curve

| age | look | when |
|----:|---|---|
| 0.0 | wet red, blood fringe | active_wound |
| 0.3 | scab dark | recovering |
| 0.7 | pink tight | recent permanent |
| 1.0 | pale / shiny line | long permanent |

Transient wounds use age→0 and clear on heal. Permanent starts at ~0.7–1.0 and never clears.

### Region graph (prevent nonsense)

Only allow paths inside region polygons on the face template. Boss events can bias region weights (e.g. fungal boss → cheek/jaw green-tinged scar style).

---

## Runtime composite order (HUD)

```
1. base face (expression from HP tier)
2. permanent scar layers (sorted by grant time)
3. active wound overlays (blood, fresh cuts)
4. status FX (poison tint, fungal dust)
```

Cap visible permanent scars (e.g. 5) for readability; store more in Soul Tome text.

---

## Pixel-art constraints

- 1–2 px stroke width at 64px face
- High contrast edge vs skin
- Prefer **linear slash** and **notch** over fine crosshatching
- Blood = few pixels at lip/chin, not full-face red wash
- Permanent scar = lighter than skin OR thin dark line — test both on kelp-warm palette

---

## Event → scar table (example)

| event | region bias | style |
|---|---|---|
| boss_floor_3 | brow_l | linear permanent |
| critical_bite | lip | split + age 0.8 |
| fungal_room_fail | cheek_r | atrophic + green edge |
| pvp_duel_loss | cheek_l | linear |
| endgame_ending_A | nose_bridge | unique authored |

---

## API sketch

```
kelplantis_grant_scar(player_id, event_id, opts)
kelplantis_list_scars(player_id) -> permanent_scars[]
face_hud_state(player_id) -> { base_tier, scars, wounds, status }
```

Inspect card uses same composite at larger size.

---

## What not to do

- Procedural scars that change every login  
- Selling “remove all scars” without an offer + fulfilment  
- Scars that don’t appear in inspect / Soul Tome  
- Photoreal normal-map pipeline before soft-pixel HUD is done  

---

## Implementation order

1. Author 8–12 atlas overlays from Grok Imagine (regions above)  
2. Wire `permanent_scars[]` + composite in bottom HUD  
3. `grant_scar` on one boss kill path  
4. Optional parametric generator for overflow events  
5. Document scar in Soul Tome string  
