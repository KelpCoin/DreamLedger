# PHINHAVEN Canonical World Terminology

Status: CANONICAL
Effective: 2026-09-24

## Geographic hierarchy

PHINHAVEN uses **Depth**, never Floor, as the canonical term for vertical world progression.

- Depth 1: Sanctuary / starting depth.
- Depth 2+: progressively dangerous depths.
- A Depth may be subdivided into tiles.
- A tile is a geographic subdivision of a Depth.
- Guild control, presence, fortification, objectives, structures, resources, and history are tracked against Depths and/or their tiles.

## Guild world state

Guilds can establish persistent presence on a Depth and across its tiles. Presence is not a binary ownership switch. A guild may build durable structures such as fortresses, outposts, watchtowers, warehouses, and gates, and may retain control indefinitely if it maintains sufficient presence and defence under the game rules.

Destruction is stateful. Structures are damaged or destroyed rather than simply erased. Salvage can return a configured portion of invested components to the guild, with 50% used as the initial design example. Construction, damage, destruction, salvage, claims, losses, and recaptures remain part of persistent world history.

## Terminology rule

Use depth / depth_id in player-facing copy, contracts, database models, APIs, tests, telemetry, and design documentation.

Do not introduce floor as a PHINHAVEN world-progression term. Legacy occurrences may remain only where they are historical, external, or technically required for migration compatibility, and must not redefine the canonical vocabulary.
