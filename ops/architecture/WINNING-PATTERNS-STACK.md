# Winning patterns stack — DreamLedger (borrow, don’t reinvent)

**Updated:** 2026-09-26  
**Intent:** Synthesize proven patterns (local LLM orchestration, multi-agent memory, modular compile targets, worker queues) and map them onto **existing** DreamLedger machinery: cube, compiler, sandbox, Agent Bus, LM Studio, Windows GPU workers.

**Money rule unchanged:** verified external revenue = **NZ$0** until Stripe livemode external evidence. Architecture does not print cash.

---

## 1. What “millions” actually requires (pattern)

Winners separate:

| Layer | Job | DreamLedger map |
|-------|-----|-----------------|
| **Demand** | Strangers with intent | Human channel + later acquisition |
| **Offer** | Executable product | Catalog + Payment Links |
| **Settlement** | External truth | Stripe oracle |
| **Fulfil** | Deliver value | Digital / tile review |
| **Memory** | Don’t forget what worked | Evidence + economic_events + word banks |
| **Orchestration** | Next permitted step | Commercial state machine + ActionPass |
| **Models** | Cheap/diverse reasoning | LM Studio multi-model + cloud fallback |

Polsia-style lesson (already on disk): schedule → worker → tools → DB.  
DreamLedger centre: **economic state**, not model personality.

---

## 2. Modular / boilerplate / compile target (website)

**Winning pattern:** Site is a **compile product**, not hand-unique snowflakes.

```
word banks + silo data + templates
        ↓
    BEC / cube compiler
        ↓
sandbox preview → gauntlet → public surface
```

| Pattern | Borrow from | Apply |
|---------|-------------|--------|
| Design tokens + modules | Shopify themes / design systems | Shared header/footer/CTA modules |
| Silo isolation | Micro-frontends / bounded contexts | `data-silo` rails; wire later |
| Compile, don’t hand-edit forever | Static site generators | `BEC-PRIME` compiler → `compiled/website` |
| Sandbox before public | Staging environments | Sandbox surface; gauntlet blocks internal leak |

**Website goal:** modular **boilerplate slots** (hero, catalog grid, trust, dock) filled by data — not one-off HTML heroics each session.

---

## 3. Cube + compiler + sandbox

| Concept | Role |
|---------|------|
| **Cube** | Bounded commercial/content cell (one CTA family) |
| **Compiler** | Turns structured inputs → HTML/JSON/assets |
| **Sandbox** | Unsafe / experimental output; not live money truth |
| **Gauntlet** | Gate: no ops jargon, no broken links, no false revenue |
| **Public** | Only gauntlet-passed modules |

Parasitic overlay (ethical read): **observe winning UX/ops patterns** (Amazon list density, Stripe trust, bottom thumb CTA, scheduled workers) and **overlay** them on cubes — do not claim competitors’ trademarks or scrape private systems.

---

## 4. Word banks + data lakes (memory that grows)

**Winning multi-agent memory pattern** (industry consensus 2025–2026):

1. **Working memory** — current job / prompt (ephemeral)  
2. **Episodic** — what happened (events, economic_events)  
3. **Semantic** — reusable facts (word banks, offer copy, buyer phrases)  
4. **Procedural** — how to act (runbooks, ActionPass types)  

| Store | DreamLedger path |
|-------|------------------|
| Structured commercial | `ops/commercial/*`, Supabase/SQLite |
| Agent coordination | `AGENT_BUS/` |
| Word banks / phrases | `ops/memory/word_banks/` (seed below) |
| Evidence lake | Stripe events + payload hashes |
| Vector/semantic (optional later) | Only after Phase 1 win — Chroma-class; not blocking |

**Genetic growth (practical meaning):** keep variants of copy/offers; **retain winners** by measured conversion/payment evidence; kill losers. Not mystical self-rewriting code.

---

## 5. Multi-LLM + LM Studio + fallback

**Winning pattern:** OpenAI-compatible local server + cloud fallback.

LM Studio exposes OpenAI-compatible HTTP; tools/function calling documented. Orchestrators route by role/cost/latency.

```
Request
  → Router (role, size, privacy)
      → primary: LM Studio local (GPU)
      → fallback 1: secondary local model
      → fallback 2: cloud API (if allowed)
  → normalize response
  → write episodic memory
```

| Role | Prefer |
|------|--------|
| Draft copy / opportunities | Local fast model |
| Code / structured JSON | Stronger local or cloud |
| Money / auth decisions | **No LLM** — deterministic |
| Embeddings (later) | Small local embed model |

**Diverse LOMs:** many local open models via LM Studio library; router picks; failure → next in chain. Persistent memory is **files/DB**, not “the chat window.”

---

## 6. GPU workers + headless PowerShell (Windows)

**Winning pattern:** split **orchestration** (CPU, queue, policy) from **inference** (GPU).

```
Orchestrator (Agent Bus / job queue)
    → enqueue job.json
Windows worker (headless PowerShell / scheduled task)
    → pull job
    → call LM Studio localhost API
    → write result.json + evidence
    → ack
```

| Rule | Why |
|------|-----|
| Workers are replaceable | GPU box can sleep; queue persists |
| Jobs are data | `ops/workers/jobs/` |
| No Stripe keys on GPU prompts | ActionPass + server-side actuators |
| Headless | Task Scheduler / service; no UI required |

Stub layout: `ops/workers/README.md`.

---

## 7. Refinement loop (persistent, multi-LM)

```
observe (data lake / evidence)
  → propose (any LOM)
  → authorize (ActionPass / human)
  → execute (actuator / worker)
  → record (episodic)
  → score (economic / engagement)
  → retain or discard variant (genetic)
```

Same as commercial Phase 1 loop; models only fill **propose** and **draft**.

---

## 8. Do not reinvent (buy/borrow)

| Need | Borrow |
|------|--------|
| Checkout | Stripe Payment Links |
| Local models | LM Studio |
| Queue | GH Actions + files + later Redis/Celery only if needed |
| Memory | SQLite/Postgres first; vectors later |
| Site modules | Compiler templates |
| Agent bus | Existing `AGENT_BUS` |

---

## 9. Path to revenue (still the bottleneck)

Modular multi-LM stacks **do not** create millions alone.  
Millions require repeated: **demand → pay → fulfil → proof → scale**.

P0 remains: distribute Phase 1 cell buy URLs; webhook → economic_event.

---

## 10. Related desks

- `ops/commercial/ECONOMIC-OPERATING-LOOP.md`  
- `ops/commercial/POLSIA-DREAMLEDGER-GAP-MATRIX.md`  
- `ops/commercial/PHASE1-RUNBOOK.md`  
- `docs/public/SILO-SEPARATION.md`  
