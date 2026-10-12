# PhinHaven agent handoff

Durable state for other LLMs and workers. Chat is not source of truth.

## Commits on `main` (newest last)

| SHA (prefix) | What |
|--------------|------|
| `fd8b878` | Public `phinhaven.html`, `ROADMAP.md`, `PVE_GUILD_TERRITORY.md` |
| `6b2c080` | `STAGE0_HOTEL_CHAT.md`, first handoff, START_HERE pointer |
| *(this)* | Stage 0 **SQL migration** + **local TEST hotel UI** |

## Files added this pass

| Path | Status |
|------|--------|
| `supabase/migrations/20261013_phinhaven_stage0_hotel_chat.sql` | Written. **Not applied** on production unless an operator runs it. UNVERIFIED. |
| `phinhaven/hotel/index.html` | LocalStorage multi-tab chat. Labeled **TEST**. Not Supabase-backed. |

## What is true

- Design contract for Stages 0–7 is in-repo.
- PvE-only guild territory design is in-repo.
- Stage 0 migration defines `ph_rooms`, `ph_guests`, `ph_presence`, `ph_messages` + RPCs (`ph_register_guest`, `ph_enter_room`, `ph_heartbeat`, `ph_post_message`, `ph_list_room_state`).
- Local hotel UI lets two browser tabs on one machine chat (storage event sync).

## What is not true

- Migration has **not** been proven applied on live Supabase.
- Hotel UI is **not** connected to Supabase.
- No external dual-session production proof.
- No revenue / player counts claimed.

## Remaining jobs

### Job A2 — Apply migration (ops)

- Apply `20261013_phinhaven_stage0_hotel_chat.sql` on the real project.
- Evidence: apply log or Supabase migration history screenshot/note + commit reference.

### Job B2 — Wire hotel UI to Supabase

- Replace localStorage with RPC calls using anon key from existing DreamLedger config patterns.
- Acceptance: two different browsers/devices chat in one room via backend.

### Job C — Cold start

- Reduce dreamledger.org wake time so `/phinhaven.html` and `/phinhaven/hotel/` are reachable without 30s spin-up.

### Job D — Nav links

- Link homepage/silos to PhinHaven without overclaiming.

## Parallelism

- A2 is ops-only; B2 depends on A2 for production proof (can develop against local/supabase CLI).
- Do not invent a second chat system; extend this Stage 0 surface.

## Read order for next worker

1. `AGENTS.md`
2. This file
3. `phinhaven/STAGE0_HOTEL_CHAT.md`
4. `supabase/migrations/20261013_phinhaven_stage0_hotel_chat.sql`
5. `phinhaven/hotel/index.html`
6. `PHINHAVEN_MASTER_OPERATING_CONTRACT.md` (commercial gates)
