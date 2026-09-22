# LangGraph checkpoint & persistence strategy (BEC)

> “Landgraf” in operator speech = **LangGraph**.

## Why this exists

Infrastructure is large; **income requires closed loops**. Persistence is used so multi-step money work (share → pay → settle → fulfil → proof) **survives restarts** and can pause for humans — not to invent sales.

## LangGraph concepts we adopt

| LangGraph | BEC mapping |
|-----------|-------------|
| `thread_id` | One economic job / first-sale run / loop instance (`THREAD-FIRST-SALE`, `THREAD-LOOP-…`) |
| Checkpoint | Snapshot after each stage (DISCOVER…PROOF) |
| `interrupt` | Human gates (share authorize, billboard review) |
| Pending writes | Completed stages not re-run on resume |
| InMemorySaver | Forbidden for production money paths |
| SqliteSaver | **Air-gap default** (`BEC-PRIME/persistence/data/checkpoints.sqlite`) |
| PostgresSaver | Production when shared workers need durable state |
| Store (cross-thread) | Catalog / loop registry / sentinels — already on disk |

## Persistence strategies (choose by environment)

### 1. Air-gap / single Windows box (now)

- **SQLite checkpointer** via `checkpoint_store.py`  
- No LangGraph install required  
- Same mental model: thread + ordered checkpoints  
- Operator runs PowerShell or Python between coffee breaks; state remains  

### 2. Optional LangGraph install (later)

```text
pip install langgraph langgraph-checkpoint-sqlite
# prod: langgraph-checkpoint-postgres
```

Compile graphs with `SqliteSaver` / `AsyncPostgresSaver`.  
Map node names to BEC loop stages.  
**Never** put Stripe secrets in graph state.

### 3. Cloud multi-worker

- Postgres checkpointer shared across workers  
- `thread_id` = durable job id from Supabase / GitHub Actions  
- Durability mode: **`sync`** for any path that touches settlement readiness  

### 4. What must NOT live in checkpoints

- Live `STRIPE_SECRET_KEY` / webhook secrets  
- Invented `verified_external_revenue_nzd`  
- Claims of sale without Stripe live `cs_` + fossil  

Revenue meter updates only via existing Settlement Sync + fossil path.

## Durability policy (BEC)

| Work | Durability |
|------|------------|
| First-sale checklist stages | Checkpoint **every** stage (sync) |
| Demand / intent notes | Append-only files OK |
| Settlement recognition | Stripe + Actions artifact is authority; checkpoint may *record* recognition after proof exists |
| Play / social | Separate threads; never merge into revenue threads |

## Income focus

Checkpoints do not create buyers. They stop **losing the place** on the path that creates income:

1. Demand pulse (share pack)  
2. Settlement Sync ready  
3. Webhook ready  
4. External pay  
5. Fulfil + proof  

Use `ops/money/run_first_sale_thread.py` to advance that thread.
