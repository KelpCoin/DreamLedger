# MMO PVE GAME DESIGN CANON
Date: 2026-10-02
Status: CANONICAL DESIGN ARTIFACT / NOT CURRENT 777 PRIORITY

## Scope

This document preserves the MMO PVE design work developed in the wife's Grok session. It is a game-design silo, not a replacement for DreamLedger's economic architecture.

## Core vision

A 100-floor PVE-focused MMO tower inspired by SAO, Diablo 2, Faldon, Second Life, Habbo, Roblox, Minecraft, EVE Online and Ashes of Creation.

Core pillars:
- 100-floor tower progression.
- Floor bosses gate progression.
- Collective floor unlock plus character-bound boss progression.
- Floor 1 is a PVE sanctuary.
- PVP begins on Floor 2 and carries permanent consequences.
- Player actions can leave persistent marks on characters and the world.
- Floors can evolve from collective player activity.
- Player-created social/economic activity can shape territory and settlements.
- Cosmetics can use stable SKU identifiers shared with the wider DreamLedger commerce substrate if and when such integration is actually built.

## Design principles

### Information creates agency

A meaningful choice requires meaningful differentiation. If two routes are indistinguishable, the decision is a coin flip rather than agency.

Floors should therefore be networks of interconnected nodes, with environmental clues, enemy information, resource signals, risk/reward cues and alternate routes.

### Curiosity and discovery

The tower should repeatedly answer player questions:
- What is beyond this route?
- What changed on this floor?
- What does the next floor contain?
- What secret resource or shortcut exists here?
- What did other players change?

Tutorialisation should be restrained. The world should communicate rules through systems, environment and consequences.

### Fragility awareness

Identify unwritten assumptions about player behaviour. Test them explicitly. If a mechanic only works because players voluntarily behave as expected, that assumption is a design dependency.

### Permanent consequences

Persistent consequences are intended to make choices meaningful. Character records, titles, territory, settlements and world-state changes can become long-lived records.

Permanent consequences must be carefully designed for fairness, abuse resistance and recoverability at the account/platform level even when individual character consequences are intentionally irreversible.

## Floor system

Each floor is a node network rather than a linear checklist.

Suggested progression:
1. Enter floor.
2. Explore multiple connected areas.
3. Gather information and resources.
4. Make route/risk choices.
5. Fight enemies.
6. Discover shortcuts/secrets.
7. Defeat floor boss.
8. Unlock the next floor.
9. Return to social/economic hub.
10. Prepare for the next floor.

Bosses may use multiple phases and behaviour changes at health thresholds.

Collective progression can unlock the next floor globally while each character still records its own boss-clear state.

## PVP and soul-consequence model

Floor 1: no PVP.

Floors 2-10: consensual or criminal PVP.

Floor 11+: deeper PVP with increasingly consequential systems.

The Soul Tome is the persistent character record:
- Current title.
- Murder marks.
- Innocent-player kills.
- Criminal-player kills.
- Other permanent character flags.

The original design contains three title tracks:

### Innocence
Examples:
- The Untainted.
- The Guardian.
- The Paragon.

### Crimson
Examples:
- The Fallen.
- The Bloodied.
- The Cursed Blade.
- The Kinslayer.
- The Hollow One.

### Bounty Hunter
Examples:
- The Redeemer.

The exact numeric bonuses and penalties remain tunable design hypotheses, not implementation requirements.

## Death

PVE death may cause:
- Unspent-gold loss.
- Limited experience loss.
- Respawn at a teleport gate.

PVP death may cause temporary skill/ability consequences.

Extreme criminal outcomes may interact with titles.

All permanent-loss mechanics require adversarial testing before production.

## Player-driven world

The world can use regional nodes/territories that accumulate activity from:
- Combat.
- Quests.
- Crafting.
- Gathering.
- Construction.
- Trade.
- Social activity.
- Guild activity.

A region can advance through settlement states and eventually become a town/city/territory.

Potential systems:
- Guild territory.
- Territory control.
- Player-built structures.
- Guild halls.
- Regional resources.
- Settlement development.
- Siege/destruction.
- Server-specific narratives.
- Persistent world-state history.

The important persistence principle is that player actions can alter future conditions rather than merely completing an endlessly reset checklist.

## Guild / territory model

Guilds are potential world-shaping actors.

Candidate persistent records:
- Guild identity.
- Membership.
- Guild reputation.
- Territory claims.
- Territory control history.
- Structures.
- Resource rights.
- Settlement contributions.
- Wars/conflicts.
- Treaties/alliances.
- World events caused or influenced by the guild.
- Historical state transitions.

Territory systems should be designed as explicit state machines, with auditable transitions rather than mutable blobs of untraceable state.

## Player-created content

Potential future systems:
- Avatar customisation.
- Guild halls.
- Personal spaces.
- Cosmetic designs.
- Player-created environmental objects.
- Creator tools.
- AI-assisted creation tools.

Player-created content introduces moderation, ownership, licensing and persistence questions. No blockchain/Web3 requirement is part of this canon.

## Avatar and cosmetic integration

Cosmetics should be visually separate from stat gear.

If integrated with DreamLedger commerce:
- Every cosmetic has a stable SKU.
- Ownership is authoritative server-side.
- Client never self-authorises ownership.
- Commerce events can unlock entitlements after verified payment.
- Webhooks/login refresh may update entitlement state.
- Cosmetic state remains separate from economic truth.

The old assumption that DreamLedger's avatar ecosystem must be built from scratch is stale. Existing DreamLedger identity/commerce surfaces may become relevant, but no integration should be invented until the actual substrate is inspected.

## Technical direction

The old research correctly rejected PowerShell 5.1 as the primary graphical game-development stack.

Candidate client engines:
- Unity.
- Godot.

Candidate server technologies:
- C#/.NET.
- Node.js.
- Python.

Candidate database:
- PostgreSQL / Supabase.

Networking:
- Reliable transport for authoritative state.
- Low-latency transport where required.
- Server-authoritative combat, health, XP, loot, inventory and world-state transitions.

PowerShell remains useful for operational automation only.

## MVP reality

The full 100-floor MMO is a large project.

A prototype should be radically smaller:
- One playable archetype.
- One test room/zone.
- Basic movement.
- Basic PVE combat.
- Basic persistent character state.
- One boss.
- Two-player networked test.
- One cosmetic entitlement.
- Basic authentication.

PVP, guild warfare, territory, creator tools and the complete 100-floor tower should remain downstream of a functioning core loop.

## 777 relationship

This game is not the purpose of 777.

It is a potential OFFER.

A game proposition can be tested through 777 before substantial game construction:

OFFER × AUDIENCE × MESSAGE × SURFACE × CTA → REAL HUMAN RESPONSE

Examples:
- 100-floor tower × MMO/PVE players × “Every floor changes what comes next” × video/community surface × join test.
- Permanent soul consequences × hardcore players × “Your character remembers what you did” × game-design landing surface × play Floor 1.
- Player-shaped territory × guild players × “Your guild can permanently change its region” × community surface × join territory test.

Only real external response validates demand. Internal design enthusiasm does not.

## Status

Preserve this design as a future commercial/game-design silo.

Do not allow it to become a new economic ledger, new orchestration system, or replacement for the canonical DreamLedger/777 substrate.
