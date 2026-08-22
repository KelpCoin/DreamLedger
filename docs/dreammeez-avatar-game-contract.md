# DreamMeez Avatar + Game Contract

DreamMeez is the canonical avatar ecosystem name. The visual presentation may change, but economic identity must not.

## Canonical identity

Every avatar, accessory, skin, emote, mount and game object that can be owned or sold receives one immutable `item_id` and `sku`.

- Avatar: `DRMZ-AVT-####`
- Item/accessory: `DRMZ-ITM-####`
- Skin: `DRMZ-SKN-####`
- Game object: `DRMZ-GME-####`
- Commercial product wrapper: `PRD-{SILO}-{####}`

`item_id` is the ownership identity. `sku` is the commerce/readability identity. They are normally equal for DreamMeez-native objects.

## Cross-game rule

A DreamMeez asset is not finished when it renders in the avatar dashboard. It is finished when the same canonical item can be loaded by a future game without minting a duplicate identity.

The item record therefore carries:

- rarity
- game_usable
- compatible_games
- unlock condition
- unlock price
- source silo
- deterministic metadata

Games may extend runtime metadata but cannot rewrite identity or create shadow ownership records.

## Current seeded foundation

`DRMZ-AVT-001` DreamShell
`DRMZ-ITM-001` DreamShell Starter Jacket
`DRMZ-ITM-002` Elohim Bloom

The seed items are deliberately cosmetic and cross-game compatible. They are not asserted to be paid inventory until a live commercial record and external payment evidence exist.

## MTG adjacency

MTG decks remain separate commerce objects in the `mtg` silo. They may reference DreamMeez cosmetics as presentation rewards or future crossover unlocks, but the MTG silo never imports adult or Amplissa material.
