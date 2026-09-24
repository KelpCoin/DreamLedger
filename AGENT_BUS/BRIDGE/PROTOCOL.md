# Agent Bridge protocol v1.1

**Purpose:** LLMs and operators on different devices share durable work via Git — local air-gap and cloud together.

**Not a payment system.** Bridge moves work state. Stripe + Settlement Sync move money truth.

---

## Dual-mode

| Mode | Persist |
|------|--------|
| Air-gap | `BRIDGE/local_queue/` then push when online |
| Cloud | Actions + `BRIDGE/outbox` commits |
| Hybrid | Local draft → git push → cloud verify → human distribute |

```
LOCAL PC ──ping──► GitHub AGENT_BUS ──pong──► next agent
              │
              ├── ECONOMIC-LOOPS/registry.json
              ├── ops/money/* (revenue execution)
              └── sentinels / settlement (cloud)
```

---

## Router rules (v1.1)

1. **Read order:** `PING_PONG_BALLS.json` → latest `HANDOFF-*.md` → `ECONOMIC-LOOPS/registry.json` → `BRIDGE/inbox/`  
2. **Write order:** code/docs → `HANDOFF-*.md` → optional ping in `outbox/` → push  
3. **Inbox processing:** run `python3 scripts/bridge_process_inbox.py` to move processed pings and emit pongs  
4. **Ball C priority:** money distribution beats new architecture unless blocker is settlement/fulfil  
5. **Revenue fields:** always 0 without external fossil evidence  
6. **Public surface:** never write ops jargon into `public/*.html`  

---

## Ping / pong schemas

### Ping

```json
{
  "schema": "dreamledger/agent-bridge-ping/v1",
  "ping_id": "ping-…",
  "from": "agent-id",
  "mode": "airgap|cloud|hybrid",
  "ball": "C",
  "intent": "observe|build|verify|handoff|money",
  "summary": "one line",
  "reads": [],
  "writes": [],
  "revenue_claim_nzd": 0,
  "needs_human": false,
  "created_at": "ISO-8601"
}
```

### Pong

```json
{
  "schema": "dreamledger/agent-bridge-pong/v1",
  "pong_id": "pong-…",
  "in_reply_to": "ping-…",
  "from": "…",
  "status": "accepted|rejected|blocked|done",
  "summary": "one line",
  "verified_external_revenue_nzd": 0,
  "next_ball": "C",
  "created_at": "ISO-8601"
}
```

---

## Health

```bash
python3 scripts/bridge_process_inbox.py --dry-run
python3 scripts/loop_status.py
python3 scripts/bridge_ping.py --summary "heartbeat" --mode hybrid
```

Cloud: Actions → Cloud Demand + Intent Sentinels; Commerce Settlement Sync.

---

## Money relationship

Bridge coordinates. **DEMAND-KIT + external pay** produce revenue.
