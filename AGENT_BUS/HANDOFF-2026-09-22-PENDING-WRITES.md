# HANDOFF — Pending writes + serde on GitHub

Operator demand: stop leaving LangGraph work only in chat; push to disk.

## Shipped on main

- `BEC-PRIME/persistence/LANGGRAPH-PENDING-WRITES.md`
- `BEC-PRIME/persistence/LANGGRAPH-SERDE.md`
- `BEC-PRIME/persistence/checkpoint_store.py` — now includes `pending_writes` table + CLI
- `BEC-PRIME/persistence/README.md`

## CLI

```bash
python BEC-PRIME/persistence/checkpoint_store.py init
python BEC-PRIME/persistence/checkpoint_store.py put-writes --thread THREAD-FIRST-SALE --super-step 1 --task settle_check --payload '{"ok":true}'
python BEC-PRIME/persistence/checkpoint_store.py list-pending --thread THREAD-FIRST-SALE --super-step 1
```

## Truth

Pending writes ≠ revenue. First-sale still needs external pay + Settlement Sync.
