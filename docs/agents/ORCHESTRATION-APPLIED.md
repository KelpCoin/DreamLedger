# LLM agent orchestration — applied

## Patterns (2026)

| Pattern | Use here |
|---------|----------|
| **Blackboard / bus** | `AGENT_BUS/` + `PING_PONG_BALLS.json` shared state |
| **Supervisor** | Operator + Ball C priority; agents do not invent revenue |
| **Structured handoff** | HANDOFF-*.md with OBSERVED/CHANGED/PERSISTED/NEXT |
| **LangGraph-style checkpoint** | Persistence docs already on disk; SQLite/Postgres later |
| **Specialists** | Commerce vs play vs surface — silo isolation |

CrewAI-style role crews are optional local tools. **Production continuity** is GitHub bus + Supabase when connected — not chat memory.

## Rules for harmony

1. Read balls before large edits  
2. Public HTML = customer English only  
3. Structured JSON/MD handoffs beat prose dumps  
4. No parallel settlement ledger  
5. `verified_external_revenue_nzd` stays 0 without fossil  
