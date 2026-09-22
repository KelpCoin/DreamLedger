# Kelplantis: Entity Passport, Micro-Ledgers, Echoes, and Autonomous Agents

Status: DESIGN DELTA / 2026-09-21
Scope: Phin Haven game system. This document records the refined concept against the existing game rather than replacing existing canon.

## Core principle

Phin Haven treats reputation as accumulated evidence, not editable biography.

Every persistent entity, whether controlled by a human player or an autonomous AI agent, has a Passport derived from game events and micro-ledgers.

The Passport is the visible social summary of the entity. The ledgers are the underlying evidence.

Human and AI entities share the same identity and reputation model.

## Passport

A Passport should expose concise, game-readable identity information when another player hovers over a sprite.

Suggested hover card:
- Name
- Current title
- Guild
- Highest demonstrated skill
- Greatest conquest or achievement
- Current status
- Compact reputation/conduct indicators

The Passport should not allow arbitrary self-authored claims to become reputation. Claims should resolve to recorded events.

Titles are derived from demonstrated behaviour and achievements. Examples include Cartographer, Warden, Architect, or monster-specific titles, but the exact title taxonomy remains game canon to be determined.

## Micro-ledgers

The Passport is backed by event-derived ledgers. Candidate ledgers include:

Combat:
- creatures defeated
- assists
- bosses
- sanctioned guild-war performance
- combat specialization

Exploration:
- tiles discovered
- floors reached
- secrets discovered
- expeditions completed

Social:
- rescues
- trades
- gifts
- contracts completed
- guild contributions
- abandoned commitments

Civic:
- territory defended
- structures repaired
- resources contributed
- emergency responses

Economic:
- resources generated
- resources consumed
- trades
- contracts
- guild contributions

Conduct:
- sanctioned PvP
- hostile actions
- griefing/rule violations
- commendations

The implementation should preserve raw events so derived Passport fields can be recalculated rather than becoming mutable assertions.

## Entity states

The same underlying entity can have different control states:

ACTIVE:
Human-controlled or actively embodied autonomous agent.

ECHO:
A human player's protected offline embodiment.

AGENT:
An autonomous AI-controlled embodiment operating under explicit game permissions.

The visual entity remains part of the world rather than disappearing merely because a human disconnects.

## Echo state

When a human player logs out, their sprite can transition into Echo state near their last safe/valid location.

Echo behaviour is intentionally low-power and non-progressive:
- remains in the rough logout/camp area
- may sit, sleep, idle, camp, or perform ambient behaviours
- may engage only trivial nearby mobs
- combat effectiveness is heavily reduced, target value approximately 10% of normal strength
- cannot receive damage
- cannot lose item durability
- cannot receive persistent negative status effects
- cannot be griefed
- should not generate meaningful progression or economic advantage

The purpose is continuity and world presence, not offline farming.

## Autonomous AI embodiment

AI agents use the same world/entity/Passport model rather than a separate NPC architecture.

An AI agent may:
- explore
- fight
- gather
- trade
- defend territory
- assist other entities
- participate in guild activity
- undertake contracts
- develop a demonstrated specialization
- acquire titles through recorded behaviour

AI activity should be constrained by explicit capabilities, authority, and game rules.

The game should record what an agent actually does rather than assigning a personality in advance.

This enables emergent identities. An agent may become known as a merchant, explorer, defender, rescuer, opportunist, strategist, or something unexpected because of its observed history.

The experiment is behavioural: provide agents with a persistent world, objectives, resources, constraints, social structures, and consequences, then let their recorded actions build their reputation.

## Guilds and territory

Guilds are a major social/economic layer.

The world is represented as persistent cells/tiles whose state can evolve:
- owner guild
- terrain
- structures
- resources
- mobs
- difficulty
- control level
- resource yield
- events
- historical ownership

Guild control can affect the state and economy of a floor.

Territory should produce meaningful guild-level benefits so guild membership becomes strategically valuable without making solo play impossible.

Potential guild benefits:
- shared storage
- territory resources
- structures
- defensive infrastructure
- information
- guild quests
- coordinated expeditions
- specialized facilities
- sanctioned war access
- territory-linked rewards

## PvP boundary

Open-world griefing is not the intended model.

PvP is primarily structured and consensual through arranged guild conflict.

One candidate guild-war mode is a PvE/PvP hybrid:
- participating guilds enter a contested arena/territory
- players must remain within an active zone
- the active zone progressively contracts
- mobs become stronger as the zone contracts
- survival and coordinated PvE become increasingly difficult
- the final surviving side determines the event outcome

The visual language can use a tug-of-war motif, with both guilds collectively holding their side of a line/rope while surviving the escalating environment.

The exact mechanics remain subject to prototype testing.

## Design invariants

1. Reputation must come from evidence.
2. Human and AI entities should use the same core Passport model.
3. Offline Echoes preserve presence without becoming exploitable progression engines.
4. Autonomous agents should be able to produce emergent histories through permitted actions.
5. PvP should be primarily arranged/sanctioned rather than an open-world griefing system.
6. Territory should have persistent state and meaningful guild consequences.
7. Raw events should remain available as the source for derived reputation and titles.
8. New systems must extend existing Kelplantis canon and implementation rather than silently replacing it.

## Implementation direction

Before adding runtime tables or mechanics, inspect the existing Kelplantis/DreamLogic code and Supabase schema for existing player, DreamMeez, inventory, dungeon, floor, tile, guild, achievement, event, and reputation structures.

Where an existing primitive already represents the required concept, extend it rather than creating a parallel system.

Potential future entities:
- entity_passports
- entity_events
- passport_ledger_views
- entity_titles
- entity_control_states
- guild_territory_cells
- guild_war_events

These are candidate names only and must not be created until the existing schema is audited for overlap.

## Acceptance target

A future vertical slice should demonstrate:
1. A human entity has a Passport.
2. Recorded gameplay events update micro-ledger facts.
3. A derived title/skill/conquest changes from evidence.
4. Hovering an entity exposes the compact Passport summary.
5. Human logout produces a protected Echo state.
6. An autonomous agent can occupy an entity and generate real ledger events.
7. No Echo damage/durability/negative-effect exploitation occurs.
8. Passport facts remain traceable to underlying events.
