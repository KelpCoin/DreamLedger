# PhinHaven Stage 0 — Hotel + Chat

Status: design + schema sketch (not production schema yet)  
Goal: smallest honest shared space so people can exist together while later stages are built.

## Player-facing promise

- Claim a room (or sit in a lobby)
- See who is online
- Chat
- No combat, no economy, no territory yet

## Suggested tables (Supabase)

Names are proposals. Prefer extending existing identity/player tables if they already exist.

### `ph_rooms`

| Column | Type | Notes |
|--------|------|--------|
| id | uuid PK | |
| slug | text unique | e.g. `lobby`, `room-12` |
| title | text | display name |
| kind | text | `lobby` \| `hotel` \| `private` |
| owner_player_id | uuid null | null for public lobby |
| capacity | int | soft limit |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `ph_presence`

| Column | Type | Notes |
|--------|------|--------|
| player_id | uuid PK | |
| display_name | text | |
| room_id | uuid FK → ph_rooms | current room |
| last_seen_at | timestamptz | heartbeat |
| status | text | `online` \| `away` \| `offline` |

Realtime on `ph_presence` so clients see who is in the room.

### `ph_messages`

| Column | Type | Notes |
|--------|------|--------|
| id | uuid PK | |
| room_id | uuid FK | |
| player_id | uuid | |
| body | text | length-capped |
| created_at | timestamptz | |

Realtime insert for chat. Rate-limit in RPC or edge function.

## Minimal RPCs / actions

1. `ph_claim_room(slug?)` — assign free hotel room or return existing claim
2. `ph_enter_room(room_id)` — update presence
3. `ph_heartbeat()` — bump `last_seen_at`
4. `ph_post_message(room_id, body)` — insert message with auth + rate limit
5. `ph_list_room_presence(room_id)` — online in room

## Client (Stage 0)

- Static or light SPA at `/phinhaven` or `/phinhaven/hotel`
- Auth: reuse DreamLedger auth if present; else anonymous display name + session
- UI: room list, current room, message list, presence list, claim button
- Do not block on Godot for Stage 0

## Acceptance tests

1. Two browsers can join the same lobby and see each other’s presence within a few seconds.
2. A message posted in room A is not visible in room B.
3. Claiming a hotel room succeeds when free; fails or queues when full (defined behaviour).
4. No combat, inventory, or currency endpoints are required for Stage 0 to pass.

## Explicit non-goals (Stage 0)

- PvP / PvE combat
- Territory / guilds
- Trading / marketplace
- Farming
- Godot client requirement

## Next after Stage 0 passes

Stage 1: furniture / room persistence (see `phinhaven/ROADMAP.md`).
