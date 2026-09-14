# Kelplantis 7B Canon Bridge

Status: ACTIVE_BUILD_INPUT

Purpose: keep Claude-recalled design context and Gemini's current 7B player-value specification aligned with the repository and Supabase control state.

## Authoritative order

1. Repository implementation and runtime evidence.
2. Supabase canonical game/control state.
3. Gemini and Claude are design/review inputs.
4. Written plans do not equal implemented or proven behavior.

## 7B target

Domino 7B is persistent identity and place in Depth 1.

Required behavior:
- finite parcel markers
- one claim action linking a player to one unassigned parcel
- Soul Tome planted at the claimed location on logout
- limited Ambient Echo beside the Soul Tome
- reconnect at the claimed Soul Tome coordinates
- active players can inspect an offline Soul Tome/Echo and see identity, title, cosmetics/scars and a short Soul Tome summary

Player-value signals:
- parcel selection
- deliberate return to parcel before logout
- accurate reconnection
- inspection of another player's planted Soul Tome
- visible status/pose modification
- repeated return to the personal anchor during a session

High-leverage additions, only after the core slice works:
- one owner-selected Echo pose and short status inscription
- offline inspection counter
- anchor recall action

Explicit exclusions for 7B:
- housing construction or furniture
- rent/taxes/decay/auctions/speculation
- parcel storage or inventory banks
- farming, gathering or crafting systems
- multi-room interiors/loading transitions
- autonomous Echo AI/pathfinding/farming/trading/combat
- combat or danger in Depth 1
- Depth 2 or deeper access
- guild/shared land

## Existing Claude-recalled canon

- Depth 1 remains the product until runtime evidence earns expansion.
- DreamMeez is the persistent avatar/social identity.
- Soul Tome is the permanent player history and physical persistent anchor.
- Logout leaves the Soul Tome at the last valid location.
- Ambient Echo is limited visual/ambient presence only. It has no autonomous game-system agency.
- Login dissolves the Echo and reconnects control at that location.
- Inspection priority is composite title, scars, equipped cosmetics and one-line Soul Tome history.
- Finite player-owned/rented real estate is intended, without pay-to-win property creation or destruction.
- Principle: make the world desirable before making it dangerous.
- Sequence remains 7A social town -> 7B persistent identity/place -> 7C farming/gathering -> 7D guilds -> 7E economy -> 7F Founder identity/cosmetics -> later adventure/PvE.

## Verification boundary

A static implementation is not proof. 7B completion requires real browser/runtime evidence, preferably two genuinely independent sessions, covering claim, logout/anchor persistence, rejoin accuracy and public inspection. Supabase persistence and realtime transport are infrastructure; player-value is demonstrated by observable runtime behavior.

## Gemini kill test

7B should be reconsidered if players routinely log out at random town coordinates without returning to their parcel and fewer than 15 percent of active town sessions include inspection of an offline player's Soul Tome/Echo. This is a refinement signal, not a fabricated success metric.

## Next domino

7C: Depth 1 local resource gathering and plot harvesting. Do not begin 7C merely because this document exists. Start it after 7B runtime evidence is sufficient to show that persistent place adds meaningful value.
