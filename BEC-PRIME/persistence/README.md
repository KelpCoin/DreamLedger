# BEC persistence (LangGraph-aligned, air-gap)

| File | Purpose |
|------|---------|
| `LANGGRAPH-CHECKPOINT-STRATEGY.md` | Strategies: SQLite now, Postgres later |
| `LANGGRAPH-PENDING-WRITES.md` | Task-level recovery model |
| `LANGGRAPH-SERDE.md` | Serialization rules + BEC hard limits |
| `checkpoint_store.py` | SQLite: full checkpoints + pending_writes |
| `data/` | Local DB path (gitignored contents OK) |

Money path entry: `ops/money/run_first_sale_thread.py` + `INCOME-NOW.md`.

**Verified revenue is never stored here as truth.** Settlement Sync + fossil only.
