# Agent Bridge protocol v1

**Purpose:** Let LLMs and operators on **different devices** (local air-gap PC, GitHub cloud, optional Supabase) hand off durable work without relying on chat memory.

**Not a payment system.** Bridge moves **work state**. Settlement Sync + Stripe move **money truth**.

---

## Dual-mode architecture

```
┌─────────────────────┐         ┌──────────────────────────┐
│  LOCAL (air-gap)    │         │  CLOUD (internet)        │
│  PC / offline        │  ping   │  GitHub AGENT_BUS        │
│  offline scripts    │◄───────►│  Actions / Render        │
│  local JSON queue   │  pong   │  optional Supabase       │
└─────────────────────┘         └──────────────────────────┘
              │                            │
              └──────── FIGURE EIGHT ──────┘
                   play lobe │ settle lobe
                             ▼
                    verified external pay
```

| Mode | What runs | What persists |
|------|-----------|---------------|
| **Air-gap** | `scripts/bridge_ping.py`, local corroboration, offline fossils | Files under `AGENT_BUS/` when synced; or `AGENT_BUS/local_queue/` until push |
| **Cloud** | Actions (sentinels, settlement, bridge gates), live site | Git commits, workflow artifacts |
| **Hybrid** | Local draft → `git push` → cloud verify → human distribute | Same bus files on both sides |

**Best of both:** Build and test offline; publish and settle online; never invent revenue offline.

---

## Shared state (the bus)

| File | Role |
|------|------|
| `AGENT_BUS/PING_PONG_BALLS.json` | Priority balls + economic truth meter |
| `AGENT_BUS/BRIDGE/inbox/` | Inbound ping messages (JSON) |
| `AGENT_BUS/BRIDGE/outbox/` | Outbound pong / handoff summaries |
| `AGENT_BUS/HANDOFF-*.md` | Structured OBSERVED/CHANGED/NEXT |
| `ops/money/*` | Revenue execution (this-week pack) |
| `AGENT_BUS/ECONOMIC-LOOPS/registry.json` | Named loops and their face (internet vs internal) |

---

## Ping message schema

```json
{
  "schema": "dreamledger/agent-bridge-ping/v1",
  "ping_id": "ping-YYYYMMDD-HHMM-xxxx",
  "from": "agent-or-operator-id",
  "mode": "airgap|cloud|hybrid",
  "ball": "C",
  "intent": "observe|build|verify|handoff|money",
  "summary": "one line",
  "reads": ["paths relative to repo"],
  "writes": ["paths written or proposed"],
  "revenue_claim_nzd": 0,
  "needs_human": false,
  "created_at": "ISO-8601"
}
```

## Pong message schema

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

**Rule:** `revenue_claim_nzd` and `verified_external_revenue_nzd` must stay **0** unless Settlement Sync + fossil evidence exists. Fabrication = bridge violation.

---

## How an LLM uses the bridge

1. Read `PING_PONG_BALLS.json` and latest `HANDOFF-*.md`  
2. Read `ECONOMIC-LOOPS/registry.json` for which loop faces the internet  
3. Do the smallest useful change  
4. Write a HANDOFF + optional ping JSON to `BRIDGE/outbox/`  
5. Push to GitHub so the other side sees it  

Local-only agents: write to `BRIDGE/local_queue/` and operator runs `git push` when online.

---

## Health checks

| Check | Pass |
|-------|------|
| Balls file parseable | JSON valid |
| Revenue field honest | 0 without fossil |
| Public HTML free of ops jargon | surface gate |
| Buy routers reach Stripe | cloud sentinel |
| Settlement workflow runnable | Actions |

---

## Relation to money

Bridge **coordinates**.  
**DEMAND-KIT + Stripe** produce revenue.  
Loops in the registry that are `internet_facing: true` are the ones allowed to market publicly.
