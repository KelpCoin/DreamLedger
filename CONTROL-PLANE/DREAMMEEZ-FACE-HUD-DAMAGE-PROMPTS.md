# DreamMeez face HUD — damage, scars, Grok Imagine prompts

**Silo:** DreamMeez / Kelplantis UI  
**Role:** Playable face of the avatar ecosystem on dreamledger.org / in-game  
**Inspiration:** DOOM status face · Fable permanent scars · Lies of P injury memory  
**Rule:** Visual claim must match game state (no decorative “fake blood” that isn’t in combat state)

---

## Product intent

Players always see **their DreamMeez face** in the UI (bottom status strip).

- Face reacts to **HP / injury / status** in real time (DOOM-style)
- Some injuries become **permanent scars** after events (Fable / Lies of P)
- Other players can **inspect** and see public scars on the avatar / Soul Tome
- Permanent scars are **earned state**, not cosmetics for sale unless a separate honest fulfilment path exists

---

## HUD layout (bottom strip)

```
┌──────────────────────────────────────────────────────────┐
│  [FACE]  HP ████░░  STATUS: bleeding · scar: left_brow   │
│  64×64   stamina · floor · home badge                    │
└──────────────────────────────────────────────────────────┘
```

- **Face tile:** 64×64 or 96×96, pixel or soft-pixel sprite, always visible in combat + town + home
- **States driven by data:** `hp_pct`, `active_wounds[]`, `permanent_scars[]`, `status_fx[]`

### State machine (minimal)

| Key | Meaning | Face cue |
|---|---|---|
| `healthy` | HP > 80% | Calm, clear skin |
| `hurt` | HP 40–80% | Wince, light bruise |
| `critical` | HP < 40% | Heavy blood, asymmetric eye |
| `bleeding_mouth` | wound flag | Blood at lip / chin |
| `scar_permanent_*` | event-locked | Permanent mark over base face |
| `poison` / `fungal` | status | Green tint / spores at edge |
| `dead` | HP 0 | Eyes dull, grey |

Permanent scars **layer on top of** transient damage; they do not reset on full heal.

---

## Data contract (game ↔ UI)

```json
{
  "dreammeez_id": "…",
  "face_base": "dreammeez_base_v1",
  "hp": 12,
  "hp_max": 40,
  "active_wounds": ["bleeding_mouth", "cut_cheek_r"],
  "permanent_scars": ["scar_brow_l", "scar_lip_split"],
  "scar_source": {
    "scar_brow_l": { "event": "boss_floor_3", "at": "2026-09-15T00:00:00Z" }
  }
}
```

UI picks sprite frame = base + max(transient tier) + scar overlays.

---

## Grok Imagine prompts

Use **portrait orientation** for face tiles; keep **consistent character** across a sheet (same bone structure, same “DreamMeez” identity).

### A. Base face (healthy) — master reference

```
Game UI character portrait tile, 1:1 square, DreamMeez avatar face only, shoulders barely visible, centered, readable at 64 pixels. Soft pixel-art / clean indie RPG sprite style (not ultra-realistic). Slightly stylized humanoid with gentle kelp-green and warm skin undertones, large expressive eyes, simple readable features. Neutral calm expression, healthy clear skin, no blood, no scars. Dark vignette UI background, high contrast for HUD. Consistent character design sheet style, front-facing, DOOM-status-face framing but original character not Doomguy.
```

### B. Hurt (mid damage)

```
Same DreamMeez face as master reference, identical bone structure and style, game HUD portrait tile. Expression pained wince, one eye tighter, light bruise on cheek, small scrape on forehead, light sweat. Soft pixel-art indie RPG, front-facing, readable at small size. No permanent scars yet. Dark UI vignette background, high contrast.
```

### C. Critical / near death

```
Same DreamMeez face, identical design language, HUD portrait. Critical condition: heavy dark bruise under eye, blood trickle from hairline, pale lips, desperate wide eye contact, asymmetric damage. Soft pixel-art game UI tile, front-facing, DOOM-style health face intensity, still the same character. Dark background, high contrast, no gore overload — readable silhouette.
```

### D. Bleeding from mouth (active wound)

```
Same DreamMeez HUD face tile. Active injury: blood at the corner of the mouth and chin, teeth slightly stained, tense jaw, determined eyes. Soft pixel-art, front-facing, clear at 64px. Match master face proportions exactly. Dark UI vignette, high contrast. Not horror-movie; game status readable.
```

### E. Permanent scar set — brow (Fable / Lies of P memory)

```
Same DreamMeez base face healthy expression, but with a permanent healed scar cutting through the left eyebrow into the forehead. Scar is pale raised line, permanent, not bleeding. Soft pixel-art HUD portrait, front-facing, same character. Shows long-term combat history like Fable or Lies of P. Dark UI background.
```

### F. Permanent scar — split lip

```
Same DreamMeez face, calm expression, permanent pale scar splitting the lower lip slightly off-center, healed not fresh. Soft pixel-art game UI tile, front-facing, identical proportions to master. Story-of-violence readable at small size. Dark vignette HUD background.
```

### G. Stacked: permanent scars + active bleed

```
Same DreamMeez HUD face. Permanent left brow scar and split lip scar visible as healed marks, PLUS fresh blood at mouth from a new wound. Expression strained. Soft pixel-art, front-facing, layered injury history. High contrast UI portrait tile.
```

### H. Poison / fungal status (Kelplantis)

```
Same DreamMeez face, sickly green-grey undertone, faint spore dust at jawline, heavy eyelids, unhealthy sheen. Soft pixel-art HUD tile, front-facing, status-effect readable, not comedy. Dark background.
```

### I. Sprite sheet instruction (one prompt for a strip)

```
Horizontal sprite sheet of one DreamMeez character face, six equal square panels left to right: 1 healthy calm, 2 lightly hurt, 3 critical pale with blood, 4 bleeding mouth, 5 healthy with permanent brow scar only, 6 permanent brow scar plus bleeding mouth. Identical face structure in every panel, soft pixel-art indie game HUD style, front-facing portraits, dark neutral background, high contrast, UI-ready.
```

### J. Inspect card (larger, for other players)

```
Character inspect panel portrait, DreamMeez avatar face and upper shoulders, soft pixel-art, permanent scars visible (brow and lip), calm proud expression after surviving bosses. Nameplate space below face. Dark elegant UI frame, kelp-green accents, readable scars as life history not gore porn.
```

---

## Implementation notes (for client)

1. Author face frames as layers: `base`, `transient_*`, `scar_*`  
2. Bottom HUD always shows composite  
3. On heal: clear `active_wounds`; keep `permanent_scars`  
4. Boss / event hooks call `grant_permanent_scar(scar_id, event_id)` server-side  
5. Public inspect reads permanent scars only (or wounds if still active)  
6. Do not sell “scar removal” without an explicit paid offer + fulfilment  

---

## Consistency tips for Grok Imagine

- Always paste: “identical bone structure to previous DreamMeez master face”
- Lock style words: soft pixel-art, HUD portrait, front-facing, high contrast, dark vignette
- Avoid: photoreal skin pores, different hairstyle each time, full-body (unless inspect card)
- Generate master first → use as reference description for every variant
