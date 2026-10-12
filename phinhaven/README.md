# PhinHaven

Public, iterate-in-public game surface for DreamLedger.

**Stage 0 intent:** chat + hotel. Not a finished MMO. No PvP.

## Public entry

| URL / path | Purpose |
|------------|--------|
| `/phinhaven.html` | Honest landing + roadmap |
| `/phinhaven/hotel/` | TEST local hotel/chat (localStorage) |
| `/phinhaven/shallows/` | Browser shallows slice |
| `phinhaven/godot/shallows/` | Godot 4 scaffold |

## Design contracts

| File | Purpose |
|------|--------|
| `ROADMAP.md` | Stages 0–7 |
| `PVE_GUILD_TERRITORY.md` | Pure PvE guild territory |
| `STAGE0_HOTEL_CHAT.md` | Stage 0 product acceptance |
| `AGENT_HANDOFF.md` | What other agents should do next |

## Backend

| File | Purpose |
|------|--------|
| `supabase/migrations/20261013_phinhaven_stage0_hotel_chat.sql` | Rooms, guests, presence, messages + RPCs |

**Status:** migration is in-repo. Do not claim it is applied on production without evidence.

## Operator / commercial

- `PHINHAVEN_START_HERE.md` (repo root)
- `PHINHAVEN_MASTER_OPERATING_CONTRACT.md` (repo root)
- `AGENTS.md` — multi-agent work rules

## Next jobs

See `AGENT_HANDOFF.md` (apply migration, wire UI to Supabase, cold-start, evidence).
