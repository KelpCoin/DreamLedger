# Single-shard presence + AI cohort (updated)

## Goals

1. **Logout presence:** human logout → sprite remains in area at **~10% strength** (ghost shell).  
2. **AI full parity:** AI characters can do **anything players can**, including **own guilds**.  
3. **Low initial AI count;** scale up later.  
4. **Stealth:** no client-facing “this is AI” label in initial phase (see `STEALTH-AI-POLICY.md`).  
5. **GPU optional** for higher-level brains.  
6. **Game must be built** as authoritative single-shard PVE (guild-based).

## Entity model

```text
controller: human_session | ghost_shell | ai_brain
strength_multiplier: 1.0 | 0.1 | 1.0 (or profile)
client_disclosure: none for ai_brain (phase 0)
server_flag: always set
```

## Non-goals

- AI as commerce agents on dreamledger.org  
- Revealing AI in settle lobe  
- Multi-shard

## Phases

| Phase | Deliverable |
|-------|-------------|
| P0 | World + characters + combat |
| P1 | Ghost 10% on logout |
| P2 | AI input path = player input path |
| P3 | Guilds shared |
| P4 | Low-N AI spawner + logs |
| P5 | GPU LLM worker optional |
