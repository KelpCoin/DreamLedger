# PhinHaven public roadmap

Status: design contract for public iteration  
Last updated: 2026-10-13  
Canonical page: `/phinhaven.html`

## One-line pitch

PhinHaven begins as a place to hang out and claim a room. Over time it becomes a persistent PvE world with territory, farming, and real progression — built in public with the people who show up early.

## Stages

| Stage | Name | What players get | Feel reference | Status |
|------:|------|------------------|----------------|--------|
| 0 | Chat + Hotel | Claim a room, talk, exist | Coke Studios / early Habbo | Live intent |
| 1 | Shared Spaces | Furniture, basic persistence, room memory | Coke Studios + light persistence | Next |
| 2 | Territory | Guilds claim land; contests are pure PvE | Soft RuneScape-style claims, no PvP | Planned |
| 3 | Gathering | Chop, mine, fish, simple crafting | Early RuneScape / Faldon | Planned |
| 4 | Farming | Crops, animals, seasons | Harvest Moon / Stardew light | Planned |
| 5 | Life Sim | NPCs, relationships, festivals | Rune Factory | Planned |
| 6 | Combat & Dungeons | Real fights, gear, progression | Toward Diablo 2 / better Faldon | Planned |
| 7 | Long-term | Persistent PvE world + strong community tools | Community-first Diablo 2 depth | Vision |

## Hard rules (do not break)

1. **No PvP.** Players never fight players. Guild competition is through the environment and systems only.
2. **Iterate in public.** Stage 0 can look embarrassing. Honesty > fake polish.
3. **No pay-to-win combat.** First monetization, if any, is non-competitive identity (cosmetic / title / founder mark).
4. **Evidence vocabulary applies.** Do not claim users, sales, or a finished MMO without verified external proof.
5. **Server authority** for ownership, territory, economy, and combat outcomes once those systems exist.

## Stage 0 acceptance (current focus)

- Public page explains what exists today and what does not.
- Players can enter a shared space / chat / hotel-style presence.
- Roadmap is visible on the page and in this file.
- Links to design docs for agents and builders.

## Stage 2 preview (territory)

See `phinhaven/PVE_GUILD_TERRITORY.md`.

Summary: parcels → guild claim → maintain with PvE activity → contest via timed PvE events (not player combat) → winner keeps or takes the parcel. Supabase holds authoritative parcel/contest state.

## How status words are used

- **Live intent** — surface and copy are public; full product may still be incomplete.
- **Next** — immediate build target.
- **Planned** — designed, not started as production.
- **Vision** — direction, not a commitment date.

## Related files

- `phinhaven.html` — public landing
- `phinhaven/PVE_GUILD_TERRITORY.md` — guild territory mechanics
- `phinhaven/godot/shallows/` — Godot 4 scaffold for The Shallows vertical slice
- `phinhaven/shallows/index.html` — browser slice
- `PHINHAVEN_START_HERE.md` — operator status
- `PHINHAVEN_MASTER_OPERATING_CONTRACT.md` — authority, economy, commercial gates
