# Kelplantis Phase 1 Social MVP Build Plan

Status: ACTIVE BUILD TARGET

## Goal

Make Depth 1 a fully playable underwater social world before expanding deeper combat content.

Core loop:

`CREATE AVATAR -> ENTER DEPTH 1 TOWN -> WALK -> SEE DREAMMEEZ -> INSPECT -> CHAT/EMOTE -> FARM/GATHER -> CRAFT -> TRADE -> LOG OUT -> SOUL TOME PRESENCE -> RETURN`

## Canon

- Kelplantis is an underwater world with 100 progressively deeper regions.
- Phase 1 builds Depth 1 only.
- Depth 1 has one creator-authored town.
- Creator Art is canonical. Engine/System Design provides functional support and must not prescribe the town's visual style, layout, architecture, atmosphere, landmarks, or audio.
- The town is a safe social/economic hub.
- DreamMeez is the persistent avatar/social identity.
- Soul Tome is both permanent history and the physical logout anchor.
- On logout, the Soul Tome remains at the last valid location with a protected, limited ambient avatar Echo.
- Echoes cannot meaningfully die, lose progression, or become full autonomous player bots.
- Normal open-world PvP is absent.
- Farming, gathering, crafting, property hooks, commerce and player interaction are first-class Phase 1 systems.
- Deeper regions and scalable party PvE remain future scope. Do not hard-code a four-player boss architecture.
- Principle: Make the world desirable before making it dangerous.

## Build priorities

1. Runtime shell and creator-art town container.
2. DreamMeez creation, movement, presence and inspection.
3. Chat, emotes and social interaction.
4. Soul Tome logout anchor and protected Echo.
5. Persistent gathering/farming loop.
6. Persistent crafting loop.
7. Player economy using existing commerce substrate.
8. Mobile-first interaction with desktop support.
9. Supabase persistence and verification.
10. Playable release-candidate proof.

## Do not build yet

- Depths 2-100 content.
- Deep raid/boss balancing.
- Generic MMO systems that are not required for Depth 1.
- Full autonomous offline agents.
- NPC-heavy simulation intended to fake population.
- A separate Soul Stone object.

## Acceptance target

A new player can create an avatar, enter the authored Depth 1 town, move around, encounter other DreamMeez/persistent Soul Tome presences, inspect identity, chat/emote, perform passive living/economic activities, craft or trade something, log out, return later, and recover authoritative state from Supabase.

Internal/test activity is not revenue and must never be represented as verified economic outcome.
