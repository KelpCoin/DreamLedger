# Kelplantis Slipstream RPG

Version: 1.0
Direction: Diablo II x Faldon x persistent social world x modern Chinese mobile-game retention patterns

## Product thesis

Kelplantis is a persistent 2D action RPG where exploration, combat, ownership, identity, status and player history reinforce one another. The player should always have a reason to return to town, descend again, improve a build, show an achievement, or challenge another player.

The product borrows mechanics and design principles, not copyrighted assets, names, audio, code, or proprietary algorithms.

## Core loop

Town/Home -> Explore -> Fight -> Loot -> Identify -> Equip/Trade/Display -> Title/Status -> Social/PvP -> New zone -> Return home

The persistent layer is mandatory. Gear, achievements, titles, player history, inventory and DreamMeez identity survive sessions and floors.

## Combat

- Fast click/tap movement and attack.
- Readable enemy telegraphs.
- Short combat encounters with occasional elite spikes.
- Bosses are mechanically distinct rather than HP sponges.
- PvE is the default safe progression path.
- PvP is opt-in and clearly marked.

## Diablo-style itemization principles

- White/common, magic, rare, unique and artifact tiers.
- Prefix/suffix affixes with deterministic provenance.
- Build-changing uniques are scarce.
- Item history records origin, first owner and notable transfers.
- No pay-to-win stat purchases.
- Monetization targets identity, expression, convenience and cosmetic prestige.

## Faldon-style freedom

Faldon demonstrates the value of free-form skills, player markets, guilds and visible titles. Kelplantis adopts those principles while modernising onboarding and presentation.

Skills should not force a rigid class choice. The player's activity creates their identity.

## F-A-L-D-O-N title system

Title families:

- FIGHTER: melee, ranged, boss and arena accomplishments.
- ARCANE: spell use, crafting and magical discoveries.
- LAND: gathering, exploration, housing and regional contribution.
- DUELIST: PvP rating and clean wins.
- OUTLAW: criminal/PvP infamy.
- ARTISAN: crafting and market milestones.
- WARDEN: cooperative defence and guild achievements.
- EXPLORER: map discovery and rare-zone completion.

Titles are earned, visible and switchable. They primarily communicate identity/status rather than raw power.

Example progression:

Novice -> Adept -> Veteran -> Master -> Grandmaster -> Paragon

Rare titles come from difficult achievements, seasonal competition, world events and historical feats.

## PvP

Three modes:

1. Duel: voluntary 1v1 with no item loss.
2. Arena: rated competitive matches with seasonal ladders.
3. Wilderness: opt-in high-risk zones with meaningful reputation consequences.

Rating should use opponent-relative gains so farming weak opponents becomes inefficient. Repeated attacks against the same target receive diminishing returns.

## Social retention

- Parties.
- Guilds.
- Guild halls.
- Player market.
- Public title display.
- Friends/presence.
- Home decoration.
- Item showcases.
- World events.
- Shareable achievement cards.

The social layer is a retention engine, not a chat box bolted onto combat.

## Modern mobile retention pattern

Current Chinese mobile-game reporting shows strong performance from low-friction entry, social sharing, content density, repeated short sessions, cross-platform identity and hybrid monetisation. Kelplantis should use the useful product mechanics without copying proprietary implementations.

Session structure:

- 30-second: open, collect, inspect, claim.
- 3-minute: clear a room or complete a micro-quest.
- 10-minute: dungeon run or arena set.
- 30-minute: guild event, boss hunt or deep expedition.

Every session should end with a meaningful state change: item, title progress, map discovery, relationship, currency, crafting result or world event.

## Audio direction

Use original audio only.

Layered sound model:

- Town: low-volume ambient bed, distant activity, soft UI ticks.
- Exploration: restrained environmental loops and positional creature cues.
- Combat: short readable impact transients, distinct enemy families, escalating boss layers.
- Loot: rarity-specific stingers with restrained repetition.
- Rare drop: unmistakable but short signature cue.
- Title unlock: ceremonial two-stage confirmation.
- PvP victory: sharp competitive sting, never a long jingle.

Audio should communicate state faster than text where possible.

## Visual direction

Dark gothic 2D fantasy with a handcrafted game-board feeling.

- Near-black stone surfaces.
- Antique metal borders.
- Deep crimson combat accents.
- Muted parchment/gold information surfaces.
- Large character silhouettes.
- Dense but readable inventory panels.
- Rune-like iconography created in-house.
- Strong depth through lighting, fog and particles.

Do not copy Diablo II UI, sprites, typography, sound effects or artwork.

## Economy

Primary currencies:

- Gold: normal play economy.
- Marks: earned competitive/event currency.
- Relics: rare account-bound progression currency.

Player market is the primary exchange surface for tradeable gear.

Commercial products should focus on cosmetics, identity, home decoration, convenience and creator/player expression. Power progression remains earnable through play.

## DreamMeez

DreamMeez is the persistent identity layer.

It stores:

- avatar appearance
- equipped title
- visible achievements
- favourite item
- home showcase
- guild affiliation
- public profile history

The avatar should feel like the player's passport through the DreamLedger worlds.

## 3MV6 integration

3MV6 generates validated, deterministic content definitions for:

- items
- affixes
- monsters
- bosses
- titles
- zones
- recipes
- cosmetics
- world events

Every generated asset receives a deterministic ID and provenance record. Generated content must pass schema validation before entering runtime data.

## Proof boundary

Kelplantis local AI verification remains read-only and evidence based. The existing pipeline already produces schema validation, model consensus, hashes and proof artifacts while keeping checkout and public state untouched. Extend that boundary rather than bypass it.

## Commercial ladder

Free entry -> identity -> retention -> social status -> cosmetic desire -> optional purchase -> repeat engagement

Do not gate the core fun loop behind payment.

## Definition of done for this phase

1. Persistent world model exists.
2. F-A-L-D-O-N title system is data-driven.
3. PvP ladder is opt-in and opponent-relative.
4. Diablo-style itemisation is original and deterministic.
5. Town/home layer persists.
6. Player market exists as a defined subsystem.
7. DreamMeez identity is attached to the character.
8. Audio events are rarity/state driven.
9. 3MV6 validates generated assets.
10. Local proof pipeline remains intact.
11. Public deployment remains approval gated.
