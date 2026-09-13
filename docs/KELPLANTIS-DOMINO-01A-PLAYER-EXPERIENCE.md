# Kelplantis Domino 01A: First 10 Minutes Player Experience

Status: DESIGN_INPUT_RECORDED
Source: Gemini player-experience pass
Implementation status: NOT_YET_VERIFIED

## Objective

Define the smallest player experience that the existing Kelplantis runtime must make real and testable before expanding the game.

## Core Flow

CREATE AVATAR -> CHOOSE SIGIL -> SANCTUARY -> SOUL TOME -> STARTER WEAPON -> ENTER FLOOR 1 -> ENCOUNTER -> TELEGRAPH -> STRIKE -> GUARD/PARRY -> CHANNEL SIGIL -> VICTORY -> TIDE-GLYPH -> INSCRIBE -> +10 MAX HP -> SAVE -> RELOAD -> STATE INTACT

## First 60 Seconds

- Spawn directly on a dark bioluminescent Floor 1 tile.
- Present three basic Archetype Sigils:
  - Tide-Stalker: Speed/Crit
  - Coral-Guard: Defense/Parry
  - Spore-Weaver: Utility/Resource
- Player chooses a Sigil, enters a name, and spawns immediately.
- Floor 1 Sanctuary is the immediate spatial anchor.
- Soul Tome Altar is directly ahead, with the Ascension Elevator beyond it.
- Movement is available immediately, with a subtle directional cue toward the Altar.

## Minutes 1-3

- Player reaches the Soul Tome Altar.
- Soul Tome opens and records baseline state: Level 1, empty inscription grid.
- Altar grants one Sigil-bound starter weapon, such as Dull Kelp-Cutter.
- Equipping the weapon updates combat state and presentation.
- Player enters the Floor 1 trial through the descent portal.

## Minutes 3-6

- Player enters a small combat chamber.
- Enemy: Corrupted Spore-Kelp.
- Combat exposes three clear actions:
  - Strike
  - Guard/Parry
  - Channel Sigil
- Enemy telegraphs its intended attack.
- Required tactical beat: player responds to a telegraphed heavy attack with Guard/Parry.
- Channel Sigil provides the final tactical action needed to defeat the first enemy.

## Minutes 6-8

- Enemy defeat produces an explicit Victory state.
- Reward:
  - +15 Kelp Shards
  - 1x Inscribed Tide-Glyph
  - +20 XP
- Extraction portal returns the player to the Sanctuary.

## Minutes 8-10

- Player returns to the Soul Tome Altar.
- Player can inscribe the Tide-Glyph.
- Inscription permanently increases Base/Max Health by +10.
- Floor 2 gate previews PvP risk without requiring Floor 2 implementation for this domino.
- Save & Exit returns to title.
- Continue reloads the avatar at the Floor 1 Altar with Sigil, stats, and glyph intact.

## Player Decisions

1. Archetype choice.
2. Damage versus mitigation during the telegraphed attack.
3. Inscribe the glyph versus retain it in inventory.
4. Safe Floor 1 exit versus approaching the Floor 2 PvP gate.

## Emotional/Perceptual Arc

- 0-1 min: immediate control and curiosity.
- 1-3 min: preparation and purpose.
- 3-6 min: tactical focus and mastery.
- 6-8 min: victory and tangible reward.
- 8-10 min: persistent ownership and anticipation of Floor 2.

## Failure Rule

Floor 1 is a PvE Sanctuary. Death is non-punitive. On defeat, the avatar respawns at the Floor 1 Altar with 50% Health and retains Floor 1 progress, gear, and items.

## Reward Rule

The Tide-Glyph must be tangible and persistent. It belongs in the Soul Tome and changes a visible/stat-backed value by +10 Max Health. It should not exist only as an abstract XP notification.

## Retention Hook

The immediate unanswered question is what happens on Floor 2 where PvP is active and unsealed items can be lost. The Soul Tome also visibly contains remaining glyph capacity.

## Anti-Patterns

Avoid:

- Unskippable lore dumps before player agency.
- Passive auto-attack combat.
- Rewards that only change invisible XP.
- Save/exit behavior whose persistence is unclear.

## Minimum Content

Entities: Player Avatar with three Sigil variants; Corrupted Spore-Kelp.
Locations: Floor 1 Sanctuary Hub; Floor 1 Combat Chamber.
Interactables: Soul Tome Altar; Floor 2 Elevator/Gate preview.
Items: Dull Kelp-Cutter; Inscribed Tide-Glyph.
UI: Avatar Creation; Soul Tome Inscription; Combat HUD; Save & Exit.

## Acceptance Tests

1. First-time player completes avatar creation and reaches the Altar in under 30 seconds.
2. Player successfully uses Guard/Parry against a telegraphed enemy attack.
3. Player inscribes the Tide-Glyph and Max Health increases by exactly +10.
4. Player saves, exits, reloads, and returns to the Floor 1 Altar with Sigil, stats, and glyph intact.

## Engineering Boundary

This document is player-experience input, not proof of implementation. It does not authorize claims that these mechanics currently exist. The next implementation step is to inspect the existing Kelplantis runtime, reuse what already works, implement only the missing pieces required for this acceptance path, and produce runtime evidence.

Floor 2 PvP, the full 100-floor tower, economy, cosmetics marketplace, and large-scale content generation are explicitly outside this domino.
