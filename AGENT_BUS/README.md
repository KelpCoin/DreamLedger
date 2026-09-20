# AGENT_BUS — continuity for multi-LLM / multi-connector work

This folder is the **pinball table**. Agents with GitHub, Supabase, or both leave durable state here so the next agent does not start from zero.

## Start here

1. **Latest figure-eight handoff:** `HANDOFF-2026-09-20-FIGURE-EIGHT-ESTUARY.md`  
2. **Machine-readable balls:** `PING_PONG_BALLS.json`  
3. Older handoffs: `HANDOFF-2026-09-17-*.md` (money, avatar, floor1)

## Principle

One hand washes the other. GitHub agents write what Supabase agents need next (and vice versa). Money is one exhaust of the loop; evidence is the dam.

## After you work

Write `HANDOFF-YYYY-MM-DD-<topic>.md` and update `PING_PONG_BALLS.json` if a ball’s status changed.
