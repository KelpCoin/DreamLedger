# PhinHaven agent handoff — 2026-10-13

This file is durable state for other LLMs and workers. Chat is not source of truth.

## Commits already on `main`

1. `fd8b87829d8ca8bd14098fac93e10077d7ef300d` — public page + roadmap + PvE guild docs
   - `phinhaven.html` — honest Stage 0 public landing
   - `phinhaven/ROADMAP.md` — stages 0–7
   - `phinhaven/PVE_GUILD_TERRITORY.md` — pure PvE territory design

2. (this commit) — Stage 0 hotel/chat sketch + this handoff + START_HERE pointer

## What is true

- Public design contract for PhinHaven Stage 0–7 is in-repo.
- PvE-only guild territory is specified (no PvP).
- Existing Godot shallows scaffold remains under `phinhaven/godot/shallows/`.
- Browser shallows slice remains under `phinhaven/shallows/`.
- Operator/commercial gates remain in `PHINHAVEN_MASTER_OPERATING_CONTRACT.md`.

## What is not true

- Stage 0 hotel/chat is **not** implemented as live Supabase tables yet (schema is a sketch).
- No verified external players or revenue for PhinHaven.
- dreamledger.org may still cold-start on free Render (ops issue, not fixed in these commits).

## Exact next jobs (pick one, claim it, ship evidence)

### Job A — Stage 0 schema migration (preferred)

- Scope: add Supabase migration for `ph_rooms`, `ph_presence`, `ph_messages` (or map onto existing player tables).
- Acceptance: migration applies cleanly; RLS policies documented; no combat tables required.
- Evidence: migration file path + apply log or CI proof.

### Job B — Stage 0 minimal UI

- Scope: simple page that lists lobby, shows presence, posts messages (can be static + Supabase client).
- Depends on: Job A or mock local storage with clear “not production” label.
- Acceptance: two sessions can chat in one room (test note + screenshots or recorded steps).

### Job C — Deploy / cold-start

- Scope: reduce dreamledger.org wake latency (paid Render, static front, or warm ping).
- Acceptance: TTFB for `/phinhaven.html` under a stated threshold from a cold state, with evidence.

### Job D — Wire public nav

- Scope: ensure homepage / silos link to `/phinhaven.html` without claiming a finished MMO.
- Acceptance: link present; wording matches evidence vocabulary in AGENTS.md / operating contract.

## Parallelism notes

- Jobs A and C do not share files → safe in parallel.
- Job B should wait for A unless using an explicit mock path labeled TEST.
- Do not edit `PHINHAVEN_MASTER_OPERATING_CONTRACT.md` unless reconciling runtime truth.

## Read first

1. `AGENTS.md`
2. `phinhaven/ROADMAP.md`
3. `phinhaven/STAGE0_HOTEL_CHAT.md`
4. `PHINHAVEN_START_HERE.md`
5. `PHINHAVEN_MASTER_OPERATING_CONTRACT.md`

## Worker rule

Commit atomically. Report SHA, what was tested, what remains. Do not mark complete without acceptance evidence.
