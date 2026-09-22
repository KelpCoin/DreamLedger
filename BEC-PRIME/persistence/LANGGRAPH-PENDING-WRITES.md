# LangGraph pending writes (BEC disk reference)

## Definition

**Pending writes** = outputs from nodes that **finished** in a super-step where **another node failed** (or the process died mid-step).

On resume, LangGraph applies those writes and **does not re-run** the successful nodes.

## Two durability layers

| Layer | When committed | Purpose |
|-------|----------------|---------|
| Task / pending writes (`put_writes`) | As each node in a super-step completes | Intra-step fault tolerance |
| Full checkpoint (`put`) | When the super-step completes | Time travel, HITL, normal resume |

Time travel uses **full checkpoints**. Pending writes are for **recovery inside a partial super-step**.

## Checkpointer API (LangGraph)

```text
put(config, checkpoint, metadata, new_versions)  → completed snapshot
put_writes(config, writes, task_id, task_path)   → intermediate task outputs
```

`writes` are typically `(channel, value)` pairs tied to a `task_id`.

## Resume sketch

```text
Super-step: nodes A, B, C parallel
  A ok → put_writes(task_A)
  B ok → put_writes(task_B)
  C fails
Resume same thread_id:
  load checkpoint + pending writes
  skip A, B; retry C (or remaining work)
```

## Side effects warning

Pending writes prevent **re-execution** of successful nodes. They do **not undo** side effects those nodes already performed (email sent, API called). Money tools must be **idempotent** (Stripe event id / `cs_` keys).

## BEC mapping

| LangGraph | BEC |
|-----------|-----|
| Super-step | Logical batch of parallel readiness checks |
| Task write | One completed subtask (e.g. `settlement_workflow_present`) |
| Full checkpoint | Stage advance on `THREAD-FIRST-SALE` |
| Revenue | **Never** from pending writes — only Settlement Sync + fossil |

## Air-gap implementation

`checkpoint_store.py` implements:

- `checkpoints` table → full stage snapshots (`put_checkpoint`)
- `pending_writes` table → task-level rows (`put_writes` / `list_pending` / `clear_pending`)

See CLI examples in that module’s docstring.

## Production note

When installing real LangGraph, use `PostgresSaver` / `AsyncPostgresSaver` with strict serde. Keep BEC money authority outside the graph.
