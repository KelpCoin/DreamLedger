# Polsia → DreamLedger component gap matrix

**Desk document — written for operator + agents.**  
**Updated:** 2026-09-25  
**Purpose:** Take Polsia’s *demonstrable architecture pattern* apart and map what DreamLedger needs. **Not a clone plan.**

## Evidence rules

| Tag | Meaning |
|-----|---------|
| **EXISTS** | Present in DreamLedger repo / live rails with concrete files or routes |
| **PARTIAL** | Design, docs, or incomplete code — not production-proven end-to-end |
| **CONCEPT** | Named in research/docs only |
| **MISSING** | Needed for commercial loop; not found as working path |

Polsia public repo caveat: open issue reports **core `backend/app/` missing** — treat Polsia as **architecture evidence**, not copy-paste source.

DreamLedger money truth: **`verified_external_revenue_nzd = 0`** until external livemode pay + evidence.

---

## Status legend (columns)

- **DL status** — EXISTS / PARTIAL / CONCEPT / MISSING  
- **Build** — exact next artifact  
- **LLM?** — may propose / draft only  
- **ActionPass?** — needs authorize record before execute  
- **Money?** — touches spend or payment truth  
- **P** — priority 0 (now) … 4 (factory)

---

## A. Agent / role layer

| Polsia | DreamLedger map | DL status | Build | LLM? | AP? | Money? | P |
|--------|-----------------|-----------|-------|------|-----|--------|---|
| Orchestrator | Mission / commercial orchestrator | PARTIAL | `ops/commercial` worker + balls Ball C | propose | yes later | no | 2 |
| Business Planning | Opportunity / mission planner | CONCEPT | Structured Opportunity JSON only after Phase 1 | yes | yes | no | 3 |
| Competitor Research | Market Observer | CONCEPT | **Do not build** before first pay | yes | no | no | 4 |
| Social Media | Social acquisition actuator | MISSING | Human posts first (`COPY-PASTE-NOW`) | draft | yes | no | 1 |
| Email Outreach | Buyer acquisition | MISSING | Human warm DM first | draft | yes | no | 1 |
| Customer Support | Support worker | MISSING | Manual email until volume | draft | no | no | 3 |
| Ads Management | Paid acquisition | MISSING | **After** Phase 1; budget caps mandatory | draft | **yes** | **yes** | 4 |
| Code Generation | Engineering worker | PARTIAL | Human/CI only; no autonomous ship | yes | **yes** | no | 3 |
| Finance | Payment verifier + economic ledger | PARTIAL | `money_pipeline.py` + Settlement Sync + webhook verify | no | n/a | **truth** | **0** |
| Deployment | Deploy actuator | PARTIAL | Render/GitHub human-gated | no | yes | no | 2 |
| Claude Code CLI runtime | Any LLM runtime | EXISTS (multi) | Keep LLM off Stripe keys | — | — | no | — |
| Agent registry / BaseAgent | AGENT_BUS + scripts | PARTIAL | Thin AgentDefinition later | — | — | no | 3 |

---

## B. Orchestration / schedule

| Polsia | DreamLedger map | DL status | Build | LLM? | AP? | Money? | P |
|--------|-----------------|-----------|-------|------|-----|--------|---|
| Celery + Redis | Queue / workers | PARTIAL | Prefer existing GH Actions + Supabase jobs | no | no | no | 2 |
| Celery Beat schedules | Cron autonomy | PARTIAL | Settlement Sync, cloud sentinels already scheduled | no | no | no | 1 |
| Task registry | Jobs list | PARTIAL | Keep distribution_queue + Actions | no | no | no | 1 |
| Sandbox mode | Fail-closed test mode | PARTIAL | Enforce livemode flags on economic_events | no | no | **yes** | **0** |

**Lesson:** “While you sleep” = **scheduler**, not magic.

---

## C. State / data

| Polsia | DreamLedger map | DL status | Build | LLM? | AP? | Money? | P |
|--------|-----------------|-----------|-------|------|-----|--------|---|
| PostgreSQL + ORM | Commercial state | PARTIAL | `ops/commercial/schema.sql` → apply to Supabase when ready | no | no | no | **0** |
| 15 company tables | orders/payments/evidence/economic_events | PARTIAL | Minimum set only (SCHEMA.md) | no | no | no | **0** |
| Alembic | Migrations | PARTIAL | Supabase migrations when promoting schema | no | no | no | 1 |
| ChromaDB vector memory | Semantic memory | CONCEPT | **Skip** until Phase 1+ | — | — | no | 4 |
| Company seed | Offer/catalog seed | EXISTS | `approved.json` + live Payment Links | no | no | no | 0 |

---

## D. Control API / UI

| Polsia | DreamLedger map | DL status | Build | LLM? | AP? | Money? | P |
|--------|-----------------|-----------|-------|------|-----|--------|---|
| FastAPI backend | Control API | PARTIAL | Existing public `server.js` + routes; commercial API later | no | yes | maybe | 2 |
| WebSocket activity | Live ops feed | MISSING | Optional after money pipe | no | no | no | 3 |
| Next.js dashboard | Operator dashboard | PARTIAL | Public shop prod-v7; full ops UI later | no | no | no | 2 |
| Metrics / agent grid | Scoreboard | PARTIAL | OPERATOR-SCOREBOARD + balls | no | no | no | 1 |
| Nginx | Edge | EXISTS | Hosting layer | no | no | no | — |

---

## E. External commercial tools

| Polsia | DreamLedger map | DL status | Build | LLM? | AP? | Money? | P |
|--------|-----------------|-----------|-------|------|-----|--------|---|
| Stripe (MoR = customer) | Stripe + Payment Links | **EXISTS** | Keep plinks aligned; webhook verify → economic_event | **no keys to LLM** | actuator only | **yes** | **0** |
| Google Ads | Paid actuator | MISSING | Phase 2+ with max_daily_spend | draft | **yes** | **yes** | 4 |
| Meta Ads | Paid actuator | MISSING | Same | draft | **yes** | **yes** | 4 |
| SendGrid / IMAP | Email | MISSING/unknown | Human email first | draft | yes | no | 2 |
| Twitter/X | Social | MISSING | Human post DO-NOW | draft | yes | no | 1 |
| Tavily search | Market research | MISSING | Skip pre-pay | yes | no | no | 4 |
| GitHub | Code / deploy | **EXISTS** | Already primary bus | no | yes for auto-PR | no | 0 |

---

## F. Infrastructure provisioning (Polsia Terms)

| Polsia | DreamLedger map | DL status | Build | P |
|--------|-----------------|-----------|-------|---|
| GitHub repo provision | N/A for MVP | — | Don’t automate | 4 |
| Neon Postgres | Supabase/Postgres | PARTIAL | Use existing | 1 |
| Render web | Live site | EXISTS | Human deploy | 0 |
| Expo mobile | N/A | — | Skip | 4 |

---

## G. Autonomy controls (critical)

| Polsia | DreamLedger map | DL status | Build | LLM? | AP? | Money? | P |
|--------|-----------------|-----------|-------|------|-----|--------|---|
| Scheduled permissions | General auth → recurring execute | PARTIAL | ActionPass-lite table in schema | no | **yes** | maybe | 1 |
| Budgets / pause ads | max_action_spend, max_daily | MISSING | Policy constants before any ads | no | **yes** | **yes** | 2 |
| Rate limits / opt-out | Outbound policy | MISSING | Before email actuator | no | yes | no | 2 |
| Credentials / OAuth vault | Secrets in GH/Render only | PARTIAL | Never in LLM context | no | yes | **yes** | **0** |
| Activity logs | Evidence + AGENT_BUS | PARTIAL | Stripe events → evidence rows | no | n/a | truth | **0** |

---

## H. Money pipeline (DreamLedger priority — not Polsia parity)

| Step | DL status | Build | P |
|------|-----------|-------|---|
| Offer / Payment Link | EXISTS | Live buy routers + approved.json aligned | 0 |
| Landing / shop page | EXISTS | prod-v7 public shell | 0 |
| create_order | PARTIAL | money_pipeline + future API | 0 |
| verify_stripe_event (signature) | PARTIAL | Harden production webhook path | **0** |
| record_payment idempotent | PARTIAL | event_id unique in payments | **0** |
| fulfill digital | PARTIAL | diagnostic/kit auto; tile review | 1 |
| record_fulfillment | PARTIAL | fulfilment evidence | 1 |
| finalize economic_event | PARTIAL | money_pipeline.py | **0** |
| balance.available separate | MISSING | Later; don’t call PI succeeded “settled” | 2 |
| External acquisition | **MISSING** | Human channel posts | **0** |

---

## I. What DreamLedger already has (do not re-invent)

| Asset | Path / note |
|-------|-------------|
| Agent bus | `AGENT_BUS/` |
| Bridge protocol | `AGENT_BUS/BRIDGE/PROTOCOL.md` |
| Economic loops registry | `AGENT_BUS/ECONOMIC-LOOPS/` |
| Settlement Sync | `.github/workflows/commerce-settlement-sync.yml` |
| Approved offers | `BEC-PRIME/catalog/offers/approved.json` |
| Commercial Phase 0 | `ops/commercial/*` |
| Public shop | `public/index.html` prod-v7 |
| Demand copy | `ops/money/DO-NOW.txt` |

---

## J. Build order (desk checklist)

### P0 — this week

1. [ ] Webhook signature verify → ingest → economic_event (test mode first)  
2. [ ] Confirm Settlement Sync secrets + live plinks  
3. [ ] Human posts Market buy URLs  
4. [ ] On first external pay: fulfil + flag external on economic_event  

### P1 — after first economic_event

5. [ ] ActionPass-lite authorize/execute for non-money actions  
6. [ ] Digital fulfil fully automatic for diagnostic/kit  
7. [ ] Optional email receipt  

### P2+

8. [ ] Bounded spend actions  
9. [ ] Single acquisition actuator experiment  
10. [ ] Only then multi-cell / factory talk  

---

## K. Explicit non-goals (from Polsia inventory)

Do **not** prioritize to “match Polsia”:

- Nine/ten agent fleet  
- ChromaDB  
- Autonomous ads + cold email  
- Code agent opening production PRs unattended  
- Infra provisioning (Neon/Render/Expo via agent)  
- Public activity feed for vanity  

---

## L. One-line architecture

```
Polsia pattern:  schedule → role prompt → Claude CLI → APIs → DB
DreamLedger:     same pattern IF NEEDED
                 + policy/ActionPass-lite
                 + Stripe as payment oracle
                 + economic_event only from verified evidence
                 + human acquisition until Phase 1 proves the pipe
```

**Hard part is not waking an LLM every 3 hours.**  
**Hard part is external pay → proof → learn without self-lying.**
