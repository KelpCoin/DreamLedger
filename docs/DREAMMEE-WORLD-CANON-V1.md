# DreamMee World Canon v1

STATUS: CANONICAL DESIGN SPECIFICATION
DATE: 2026-08-23

## Core identity

Canonical public doorway:
https://dreamledger.org/

Canonical CTA:
Make your free DreamMee

DreamMee is persistent player identity: avatar, progression, assets, guild membership, titles, history, and proof references.

## World topology

The world contains 100 floors. A player defeats the canonical boss for floor N to unlock personal access to floor N+1. Boss clears are persistent historical events. Floor 1 is social/sandbox-first and does not require PvP.

Players may specialise in social building, commerce, crafting, exploration, guild leadership, PvE, PvP, collecting, or mixed play. Progression is not a demand that every player use every subsystem.

## Five primitives

PLAYER: persistent identity and state.
ASSET: owned game object with provenance.
PLACE: addressable world location or property.
EVENT: immutable state transition record.
RULE: deterministic consequence applied to an event/state condition.

## Canonical event chain

PLAYER action -> EVENT -> RULE evaluation -> state transition -> proof artifact.

Economic events additionally require settlement evidence from an authorised payment/transaction source. A hash proves integrity of recorded evidence; it does not independently prove that an external event was true.

## Canonical boss gate

Boss defeat may unlock:
- next floor access
- new asset classes
- recipes
- avatar capabilities
- land/place types
- guild privileges
- titles

Unlock effects must be deterministic and versioned.

## Functional titles

Titles can modify rules, reputation, access, or economic utility. Transferability is an explicit rule property and must never be assumed.

## MTG simulation laboratory

The MTG corpus is a content source for the world. Each deck record should support:
- commander
- colors
- archetype
- decklist
- power estimate
- economic value
- matchup statistics
- deterministic simulation seed
- reproducible proof reference

Monte Carlo is statistical analysis. Cinema is deterministic narrative replay. Proof artifacts bind inputs, configuration, outputs, and hashes.

## AI refinement factory

AI observes player, economic, search, guild, combat, retention, progression, and content signals.

AI proposes changes.
Simulation tests them.
Governance evaluates them.
Human approval controls production changes.

No AI proposal may directly rewrite production economy or public-facing state.

## Economic flywheel

Discover -> Create -> Play -> Transact -> Observe -> Learn -> Refine -> Ship -> Repeat

The first economic proof is a real settlement event. Synthetic revenue is prohibited.

## Canonical route model

/dreammee
/floor/1
/floor/N
/floor/1/house/{player_id}
/floor/1/shop/{guild_id}
/floor/10/arena/{guild_id}
/land/{plot_id}
/mtg
/guild
/event
/market

## Commercial boundary

Public automation is approval-gated.
Payment verification may be automated.
Fulfillment work may be generated automatically from verified payment evidence.
Public posting and outbound buyer contact remain disabled unless explicitly authorised.

## Implementation truth rule

This document is the design authority. A feature is not considered BUILT merely because it is described here. Repository code, tests, deployment evidence, or production telemetry must support a BUILT claim.
