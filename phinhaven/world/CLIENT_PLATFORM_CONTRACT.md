# PHINHAVEN Client Platform Contract v2

## Authority

Supabase/Postgres is the persistent backend and authoritative data layer. It is **not** the game client and it is **not** the game engine.

A PHINHAVEN player must always experience the game through a client.

Current client:
- Browser client: `phinhaven/shallows/index.html`
- Legacy/public mirror: `public/phin-haven.html`

Engine/client targets:
- Godot native client: existing project, being connected to the same server contract
- Unity client: future interchangeable client using the same server contract

## Client responsibility

A client owns:
- rendering
- input
- menus
- character presentation
- camera
- animation
- audio
- local UI state
- platform-specific controls

A client does not own authoritative:
- character progression
- boss completion
- Depth unlocks
- inventory truth
- combat outcomes
- world history

## Backend responsibility

The server/backend owns:
- persistence
- validation
- progression
- canonical event history
- boss completion
- Depth gates
- combat resolution
- inventory changes
- world-state changes

Supabase Edge Functions may provide server endpoints. They remain server-side infrastructure, never the client.

## Current playable MVP loop

1. Open the browser client.
2. Create a character.
3. Enter Depth 1 / The Shallows.
4. Explore and encounter enemies.
5. Fight The Sprout King.
6. The canonical `FLOOR_BOSS_DEFEATED` event is created by server-side event canonicalization.
7. Depth 2 unlocks.
8. Client displays an **Enter Depth 2** control.
9. Enter Depth 2 / Frontier.
10. Fight its current expedition encounters.
11. Return to Sanctuary.

## Gate invariant

Depth 2 is not unlocked by a client flag, localStorage value, payment, URL parameter, or direct database write.

The authoritative gate is:

`phinhaven_soul_events`
→ `FLOOR_BOSS_DEFEATED`
→ `floor_id = 1`
→ `verified = true`
→ `payload.boss_key = floor_1_boss`

The existing server-side canonicalization trigger derives that event from the authoritative Sprout King boss defeat event.

## Platform rule

Build one PHINHAVEN world and multiple clients. Do not build separate game economies or progression rules for Browser, Godot, Unity, iOS, Android or desktop.

The same player/world truth must survive changing clients.
