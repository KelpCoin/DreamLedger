# Commercial execution layer

**Economic loop (centre):** see `ECONOMIC-OPERATING-LOOP.md`  
**Polsia gap desk:** see `POLSIA-DREAMLEDGER-GAP-MATRIX.md`

```
LLM proposes → policy / ActionPass-lite → actuator → Stripe
                                                      ↓
                         verified webhook → payment → fulfil → economic_event
```

State is the centre. Agents are replaceable workers.

## Phases

| Phase | Goal |
|-------|------|
| 0 | Instrumentation (money_pipeline) |
| 1 | One cell: offer → pay → fulfil → economic_event (human acquisition OK) |
| 2 | One acquisition channel + orchestrator-from-state |
| 3+ | Learning experiments; only then broader autonomy |

## Key files

- `ECONOMIC-OPERATING-LOOP.md` — bridge architecture desk  
- `POLSIA-DREAMLEDGER-GAP-MATRIX.md` — component matrix  
- `money_pipeline.py` / `schema.sql` / `STATE_MACHINE.md`  
- `DO-NOT-BUILD-YET.md`  
