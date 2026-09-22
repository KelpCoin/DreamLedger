# START HERE — full session continuity (2026-09-22)

**For the operator / husband:** everything material from multi-LLM work today is **on GitHub `main`**, not only in chat. Read this file + `PING_PONG_BALLS.json`.

---

## Truth meter

- **Verified external revenue: NZ$0** until live stranger pay + Settlement Sync + fossil.  
- Architecture and play design do **not** count as income.

---

## Money path (Ball C)

| Item | Path / value |
|------|----------------|
| Income runbook | `ops/money/INCOME-NOW.md` |
| First-sale thread | `ops/money/run_first_sale_thread.py` + `Run-FirstSaleThread.ps1` |
| Primary Payment Link | https://buy.stripe.com/dRmbJ2cZi9eW4mk9La9oc02 |
| Store | https://dreamledger.org/?src=dist |
| Settlement | Commerce Settlement Sync workflow |
| Blockers (250) | `ops/autonomy/BLOCKERS-AUTONOMOUS-REVENUE-ENGINE.md` |
| Top blockers | `ops/autonomy/TOP-BLOCKERS.md` |

**Human still required:** post link, secrets, webhook, first external buyer.

---

## Figure-eight + fulfilment

| Item | Path |
|------|------|
| Figure-eight architecture | `BEC-PRIME/architecture/FIGURE-EIGHT.md` |
| Performance Wall (key→cubby→24h seal) | `BEC-PRIME/fulfillment/PERFORMANCE-WALL.md` |
| Wall schema / air-gap mint | `performance-wall.schema.json`, `performance_wall.py` |
| Stripe webhook performance | `BEC-PRIME/commerce/STRIPE-WEBHOOK-PERFORMANCE.md` |

---

## Persistence (LangGraph-aligned)

| Item | Path |
|------|------|
| Checkpoint strategy | `BEC-PRIME/persistence/LANGGRAPH-CHECKPOINT-STRATEGY.md` |
| Pending writes | `BEC-PRIME/persistence/LANGGRAPH-PENDING-WRITES.md` |
| Serde | `BEC-PRIME/persistence/LANGGRAPH-SERDE.md` |
| SQLite store + pending_writes | `BEC-PRIME/persistence/checkpoint_store.py` |

---

## Trust / agent passports

| Item | Path |
|------|------|
| Passports + commerce trust wedge | `BEC-PRIME/trust/AGENT-PASSPORTS-AND-COMMERCE.md` |
| Schema | `BEC-PRIME/trust/agent-passport.schema.json` |

Settle lobe: honest labeling. Play stealth AI is separate (below).

---

## Play shard (Phin Haven direction)

| Item | Path |
|------|------|
| Single-shard + ghost 10% + AI cohort | `docs/play/SINGLE-SHARD-AI-PRESENCE.md` |
| Stealth AI policy (no client badge phase 0) | `docs/play/STEALTH-AI-POLICY.md` |
| Full parity + AI-owned guilds | `docs/play/GUILD-AI-BEHAVIOR.md` |
| GOAP + behavior trees | `docs/play/GOAP-AND-BEHAVIOR-TREES.md` |
| NPC/AI economy | `docs/play/NPC-ECONOMY-MODEL.md` |
| GOAP action seed | `docs/play/goap-action-catalog.json` |
| Scaling (low-first) | `docs/play/AI-COHORT-SCALING.md` |
| Build checklist | `docs/play/BUILD-PLAY-SHARD.md` |

**Game is design-ready, not proven playable as full MMO.** See also `PHINHAVEN_START_HERE.md`.

---

## Supabase / client builds (Claude diagnosis, on disk)

| Item | Path |
|------|------|
| Status | `docs/play/SUPABASE-CLIENT-BUILDS-STATUS.md` |
| Failure UX contract | `docs/play/CLIENT-CONNECTION-FAILURE-CONTRACT.md` |

- Sandboxed LLMs **cannot** reach live Supabase.  
- Table name after rebrand: **`phinhaven_client_builds`**.  
- Client must **not** silent-fail on login; probe then loud error.  
- Recover latest build from Supabase → **commit into git**.

---

## Agent bus

| Item | Path |
|------|------|
| Balls (machine-readable) | `AGENT_BUS/PING_PONG_BALLS.json` |
| Figure-eight estuary handoff | `HANDOFF-2026-09-20-FIGURE-EIGHT-ESTUARY.md` |
| This index | `START-HERE-SESSION-2026-09-22.md` |

---

## Immediate operator actions

1. `git pull` on DreamLedger `main`.  
2. Read `PING_PONG_BALLS.json`.  
3. Money: post Payment Link + confirm Stripe secrets/webhook.  
4. Play: recover client from `phinhaven_client_builds` / Storage into repo.  
5. Do not treat chat history as the system of record — **this folder is**.
