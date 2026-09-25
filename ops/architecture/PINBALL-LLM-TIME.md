# Pinball LLM time — Agent Bridge rhythm

## Metaphor

Each LLM is a flipper. **GitHub + balls** are the table. The ball must not die in a chat window.

## Read order (every session)

1. `AGENT_BUS/PING_PONG_BALLS.json`  
2. Latest `AGENT_BUS/HANDOFF-*.md`  
3. `ops/architecture/SYSTEM-OVERLAY.md`  
4. `ops/commercial/PHASE1-RUNBOOK.md` if Ball C is hot  

## Write order (end of session)

1. Update balls (truth, next, do_not)  
2. Write/refresh HANDOFF  
3. Push code/docs that matter  
4. Never claim revenue without economic_event evidence  

## Multi-LM

- Diverse models OK (LM Studio, cloud, this session)  
- Fallback on draft jobs only  
- Shared memory = repo + Supabase — not one vendor’s chat  

## Bridge health signals

| Signal | Healthy |
|--------|--------|
| Balls updated | Recent date + honest revenue 0 or real |
| Handoffs | Next agent can act without chat |
| Inbox/outbox | Protocol files present if used |
| Money | Fail-closed; Stripe is oracle |

## Pinball priorities (default)

1. **C** — distribute + settle + fulfil  
2. **W** — public surface deploy match main  
3. **B** — bridge continuity  
4. Architecture only when C is unblocked  
