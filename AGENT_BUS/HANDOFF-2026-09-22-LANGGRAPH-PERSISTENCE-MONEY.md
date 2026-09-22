# HANDOFF — LangGraph persistence + income path

## Request

Explore LangGraph ("Landgraf") checkpoints & persistence; incorporate into system; push GitHub / air-gap scripts; infrastructure must support income now.

## Delivered

- `BEC-PRIME/persistence/LANGGRAPH-CHECKPOINT-STRATEGY.md`
- `BEC-PRIME/persistence/checkpoint_store.py` — SQLite air-gap checkpointer
- `ops/money/run_first_sale_thread.py` — THREAD-FIRST-SALE staged advances
- `ops/money/Run-FirstSaleThread.ps1` — Windows entry
- `ops/money/INCOME-NOW.md` — shortest path to cash using existing surfaces

## Truth

Checkpoints ≠ revenue. NZ$0 until external live settle + fossil.
Primary income action remains: **post Payment Link + Settlement Sync + webhook**.
