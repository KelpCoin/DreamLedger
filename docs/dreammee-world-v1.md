# DreamMee World v1

Status: Q1 architecture contract

## Product
DreamMee is a player-owned persistent world layered onto DreamLedger. The game is a sandbox first, with optional progression into deeper RPG systems.

## Core primitives
PLAYER: persistent identity and progression state.
ASSET: avatar items, equipment, property, guild assets and other owned state.
PLACE: floor, parcel, room, shop, guild territory or other addressable location.
EVENT: an auditable state transition such as purchase, duel, boss defeat, title award or guild action.
RULE: the deterministic policy that maps events to state changes.

## 100-floor topology
There are 100 canonical floors. Each floor has a canonical boss. A player may remain on any unlocked floor indefinitely. Floor 1 is intentionally viable as a social, collection, housing and light-economy environment. Higher floors can progressively expose crafting, exploration, combat, trading, guild warfare and deeper RPG systems.

## Progression gate
A player may access floor N+1 only after satisfying the canonical boss gate for floor N. Boss completion is an event with provenance and must be reproducible from the event ledger.

## Functional titles
Titles are state, not merely cosmetics. A title may modify permissions, reputation, access, combat modifiers, economic privileges or interactions. Every title record should retain earned_by, earned_at, defeated_entity, floor, guild, ability_delta and transferable fields where applicable.

## Digital real estate
Property is addressable game state. Examples include homes, shops, guild halls, farms, arenas, dungeons, market stalls, crafting facilities, museums and display surfaces. Scarcity must not be manufactured through fake countdowns or fabricated supply. Value should emerge from utility, location, access, history, reputation and demand.

## Guild governance
Guilds can compete over influence and propose floor configurations. A floor can expose multiple candidate modes, such as social, farming, merchant, exploration or combat. Player activity, guild objectives and governance outcomes can determine which configuration is adopted, subject to operator safety and economic gates.

## AI refinement factory
AI observes player behaviour, economic events, demand signals, guild activity, combat statistics, feature abandonment, popular assets, community signals and progression. It proposes mechanics, assets, quests, floor configurations and experiments. Simulation tests proposals. Governance evaluates them. Human/operator approval controls production changes.

## Economic loop
Discover -> create -> play -> transact -> observe -> learn -> refine -> ship -> repeat.

## Safety and trust boundaries
No fabricated scarcity. No fabricated transaction claims. No rules-accurate MTG win-rate claims without real decklists and a rules model. AI proposals cannot silently alter production rules. MTG and adult silos remain isolated.
