# Agent Bridge

Canonical protocol: **`PROTOCOL.md`**

```
inbox/        ← messages for the next agent to read
outbox/       ← messages this side produced (push with git)
local_queue/  ← air-gap drafts until online
```

Local ping:

```bash
python3 scripts/bridge_ping.py --summary "Day0 link alignment done" --ball C --mode hybrid
```

Then `git add AGENT_BUS && git push` so cloud agents see it.
