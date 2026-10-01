# Master silo stencil (MTG)

**CSS:** `public/assets/silo-master.css`
**Reference page:** `public/mtg.html`

## Typography
- Display / H2 / H3: **Instrument Serif** (weight 400, italic accent)
- UI / body: **DM Sans** 400–700
- Scale: `.silo-display` → `.silo-h2` → `.silo-h3` → `.silo-lead` → `.silo-eyebrow`

## Colour
- Background: deep ink `#0a0b0f`
- Surface: `#161922`
- Text: warm paper `#f4f1ea` / muted `#9aa0b0`
- Accent gold: `#d4a84b` → `#e8c06a` (CTAs, trust)
- OK green: `#3d9b6e` (badges only)

## Cube clone
1. Copy `silo-master.css`
2. Optionally set `--silo-accent` for a different silo mood
3. Copy MTG HTML shell; replace copy + rails only
4. Keep class names `.silo-*` so clones stay consistent

## Related surfaces (same visual language)
- mtg-list, mtg-search, mtg-mod, mtg-welcome
