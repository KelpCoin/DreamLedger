# Endless silo clone (cube)

## Master
- CSS: `/assets/silo-master.css`
- Page: `/mtg` ← reference implementation
- Manifest: `public/silo-clone-manifest.json`
- Template: `public/silo-template.html`

## Already cloned shells
- `/retro` ← `public/retro.html` (blue accent)
- `/vinyl` ← `public/vinyl.html` (rose accent)

## Endless recipe
1. Add object to `clones[]` in manifest
2. Fill SILO_* + HERO_* + CTA fields
3. Generate HTML from template (or copy retro/vinyl and edit)
4. Ship `public/{path}.html`
5. Register in `surfaces.json`

## Invariants (do not break when cloning)
- Buy without account
- Sell requires free account
- 0% success fee on peer merchandise
- `.silo-*` class prefix + shared CSS
- Constructive tone only
