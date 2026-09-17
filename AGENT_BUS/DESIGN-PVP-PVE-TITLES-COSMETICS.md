# Design contract — PvE, PvP, titles, cosmetics (operator 2026-09-17)

## Confirmed intent

1. **PvE is the default focus** everywhere in The Shallows (Depth 1) and general play.
2. **PvP is limited** to:
   - Arranged duels (opt-in)
   - Guild wars for territory control
   - Not open-world free-for-all in Depth 1 / First Garden
3. **Titles** visible when hovering / focusing another player so you can read their general focus (e.g. explorer, crafter, guild rank).
4. **DreamMeez avatars** and Phin Haven characters should be **interchangeable / linkable** — one identity, shared cosmetics where paid.
5. **Paid cosmetics and in-game items** sold for real money (Stripe) should map into both avatar surface and game appearance where the entitlement exists.

## Implementation status (honest)

| Capability | Status 2026-09-17 |
|------------|-------------------|
| Create character + play Depth 1 (RPC) | **Works** (`kelplantis_create_player` returns player row) |
| Live URL `/phin-haven.html` | On **GitHub main**; **Render may still 404** until redeploy |
| Two people, two devices | **Yes** once URL is live — each creates own character |
| DreamMeez bootstrap RPC | Exists; needs valid player token + entitlement wiring |
| Full avatar ↔ game cosmetic parity | **Not complete** — Stripe cosmetics on store; game equip is separate inventory |
| Hover titles on other players | **Not built** — presence shows name only |
| Guild war / arranged duel PvP | **Not built** — Depth 1 is PvE-only by design |

## Next engineering order

1. Render promote → public play URL
2. Stripe settlement → grant cosmetic entitlement → `kelplantis_bootstrap_dreammeez` / equip surface
3. Presence payload includes `title` string; client draws title on hover
4. Guild + duel systems only after PvE loop and paid cosmetic loop work
