# PhinHaven agent handoff

Durable state for other LLMs and workers. Chat is not source of truth.

## Commits on `main` (newest last)

| SHA (prefix) | What |
|--------------|------|
| `fd8b878` | Public `phinhaven.html`, `ROADMAP.md`, `PVE_GUILD_TERRITORY.md` |
| `6b2c080` | `STAGE0_HOTEL_CHAT.md`, first handoff, START_HERE pointer |
| `4f57945` | Stage 0 SQL migration + TEST hotel UI |
| *(this)* | Home nav + ecosystem card + hotel CTA + `phinhaven/README.md` |

## In-repo surface map

| Path | Status |
|------|--------|
| `phinhaven.html` | Public landing |
| `index.html` | Links to PhinHaven (nav, hero secondary, ecosystem card, footer) |
| `phinhaven/hotel/index.html` | TEST localStorage multi-tab chat |
| `supabase/migrations/20261013_phinhaven_stage0_hotel_chat.sql` | Written; **apply not proven** |
| `phinhaven/README.md` | Index for agents |

## Done vs not done

**Done in-repo**

- Public copy and roadmap
- PvE guild territory design
- Stage 0 migration file
- Local TEST hotel UI
- Discoverability from homepage

**Not done / UNVERIFIED**

- Migration applied on live Supabase
- Hotel UI talking to Supabase RPCs
- Dual-device production presence proof
- Site cold-start fix
- Any player or revenue claims

## Remaining jobs

### Job A2 — Apply migration (ops)

Apply `20261013_phinhaven_stage0_hotel_chat.sql`. Evidence: migration history / apply log.

### Job B2 — Wire hotel UI to Supabase

Replace localStorage with `ph_register_guest`, `ph_enter_room`, `ph_post_message`, `ph_list_room_state`. Evidence: two devices, one room.

### Job C — Cold start

Make `/phinhaven.html` and `/phinhaven/hotel/` reachable without long Render spin-up.

### Job D — Discoverability

**Done in this commit** (nav + ecosystem + CTAs). Revisit if links break after deploy.

## Read order

1. `AGENTS.md`
2. `phinhaven/README.md`
3. This file
4. `STAGE0_HOTEL_CHAT.md` + migration SQL
5. `PHINHAVEN_MASTER_OPERATING_CONTRACT.md`
