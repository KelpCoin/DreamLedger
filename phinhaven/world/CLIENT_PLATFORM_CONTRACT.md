# PHINHAVEN Client Contract v1

PHINHAVEN is client-neutral. The authoritative gameplay state lives behind the PHINHAVEN server boundary. Clients render and send bounded intents; they do not become world truth.

## MVP clients
- Browser: `phinhaven/shallows/index.html`
- Godot: existing native prototype, next adapter target
- Unity: compatible future client using this same action/state contract

## Shared actions
- create
- state
- move
- enter_depth
- return_town
- chat

## MVP player loop
create character -> sanctuary -> see another active player -> walk -> chat -> enter Depth 2 -> move/fight/gather -> die or return -> bank loot -> repeat.

## Platform rule
Prefer one world/backend and many clients. Do not fork game rules per engine.

## Authority rule
The server validates player token, scene, movement bounds, combat resolution, loot banking and persistence. Client-side rendering is presentation only.

## Canonical vocabulary
Use Depth, never Floor, for player-facing world progression.