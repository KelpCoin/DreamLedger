# DreamLedger economic operating loop

**Desk document — 2026-09-25**  
**Not:** copy Polsia’s list of agents.  
**Yes:** steal the *machinery* (schedule → worker → tools → state → next task) and put DreamLedger’s **economic loop** at the centre.

```
Polsia-style skeleton:   Company → Agents → Tasks → Tools → World → Results → DB → Next
DreamLedger centre:      Market → Opportunity → Buyer → Offer → Acquisition
                         → Payment → Fulfilment → Outcome → Evidence → Learning → Next
```

The second loop is more commercially explicit. The mistake is recreating Polsia agent-for-agent.

---

## 1. Centre: economic state (not the agent)

**Bad:** Agent → does thing  
**Better:**

```
Commercial State
  → What is currently true?
  → What is the next permitted transition?
  → Which worker may perform it?
  → What evidence proves completion?
  → What changed economically?
```

Models (Claude / GPT / Qwen / local) are **replaceable**. Deterministic Python can own transitions.

Related: `STATE_MACHINE.md`, `SCHEMA.md`, `money_pipeline.py`.

---

## 2. Seven workers (not ten permanent agents)

| # | Worker | Job | Outputs | Build phase |
|---|--------|-----|---------|-------------|
| 1 | **Market Observer** | What in the world might create opportunity? | `MarketSignal` | After Phase 1 (human hypothesis first) |
| 2 | **Opportunity Engine** | Is there a testable commercial experiment? | `Opportunity` | Phase 1 human-authored; automate later |
| 3 | **Offer Engine** | Executable product/price/copy/fulfil | `Offer` + cell | Phase 1 (catalog already has offers) |
| 4 | **Acquisition Engine** | Channels as tools, not forever-agents | outreach / traffic | Phase 2; Phase 1 = human |
| 5 | **Payment Engine** | Boring Stripe truth | payment records | **Phase 0–1 now** |
| 6 | **Fulfilment Engine** | money → delivered value | delivery evidence | Phase 1 |
| 7 | **Truth Oracle + Learning** | Classify evidence; next experiment | outcome, next action | Phase 1+ |

**Commercial Orchestrator** (thin): reads state, enqueues next permitted job. Not a personality CEO.

---

## 3. Opportunity record (machine-readable experiment)

```
opportunity_id
buyer_segment
problem
evidence[]
existing_alternatives
estimated_value
proposed_offer
acquisition_channel
test_cost
expected_signal
risk
status
```

Example shape:

```
OP-000041
Buyer: NZ ecommerce operators
Problem: description bottleneck
Offer: 10 descriptions NZ$50
Acquisition: cold email (later) / human DM (now)
Success event: Stripe payment ≥ NZ$50 livemode
```

This is what generic “business planning” often lacks: a **testable commercial experiment**.

---

## 4. Offer must be executable

Not “businesses might like this.”  
Must close:

```
BUYER → OFFER → PRICE → PAYMENT → DELIVERABLE
```

Existing DreamLedger assets: approved catalog, `/buy/...`, Payment Links, shop surface.

---

## 5. Acquisition = channels, not permanent agents

```
AcquisitionChannel
  ├── Email
  ├── X / social
  ├── Meta / Google (later, budget-capped)
  ├── Marketplace
  └── Direct / web
```

Orchestrator policy example:

```
no prospects     → find (or human supplies)
prospects        → outreach
replies          → follow-up / checkout link
payment          → STOP acquisition → fulfil
zero response    → change message/offer or abandon experiment
```

Phase 1 acquisition is **human-assisted**. That still proves the commercial machine.

---

## 6. Payment engine (boring)

- Stripe = settlement/payment **oracle**  
- AI saying “someone bought” is **not** a purchase  
- Webhook signature verified → idempotent payment row → economic_event  
- `payment_intent.succeeded` ≠ bank settlement; track `balance.available` separately later  

See `money_pipeline.py`, Settlement Sync, catalog plink alignment.

---

## 7. Fulfilment

```
payment.succeeded → fulfilment job → artifact → quality check → deliver → evidence
```

MVP: digital (diagnostic, kit). Tile: allocate + human review before publish.

---

## 8. Truth Oracle (not an LLM)

| Class | Meaning |
|-------|---------|
| **OBSERVED** | External system fact (Stripe event, delivery log) |
| **INFERRED** | Derived, labelled as inference |
| **CLAIMED** | Agent statement, untrusted alone |
| **VERIFIED** | Independent evidence chain closed |

LLM **interprets** evidence. It does **not** manufacture payment truth.

---

## 9. Commercial event ledger (event-centric)

Example types:

`market.signal` · `opportunity.created` · `offer.published` · `outreach.sent` ·  
`checkout.created` · `payment.succeeded` · `fulfillment.started` · `delivery.confirmed` ·  
`experiment.completed` · `refund.completed`

Each event: `event_id`, `timestamp`, `actor`, `opportunity_id`, `offer_id`, `channel`, `result`, `evidence_ids`, `cost`, `revenue`, `correlation_id`.

Minimum tables already in `SCHEMA.md`.

---

## 10. ActionPass (think vs do boundary)

```
Agent proposes → ActionPass record → policy checks → actuator executes → result recorded
```

MVP = DB row (`commercial_actions`), not multi-domain crypto.  
LLM never holds unrestricted Stripe or ads credentials.

---

## 11. Task state machine (work items)

```
DISCOVERED → QUALIFIED → PROPOSED → AUTHORIZED → EXECUTING
  → OBSERVING → VERIFIED → COMPLETED
```

Failures: `FAILED` → retry / modify / abandon.  
Proposed work ≠ executable work until AUTHORIZED.

---

## 12. Polsia machinery underneath (optional pattern)

Reuse the *pattern*, not the product:

```
schedule → queue → worker → model CLI → tools → DB → dashboard
```

DreamLedger today: GitHub Actions, Agent Bus, Supabase, public server, commercial SQLite/Postgres schema. Add heavier queue only when jobs demand it.

---

## 13. Do not build

- Giant agent framework / AI CEO personality  
- Ten overlapping autonomous authorities  
- Own payments, email, or ads platforms  
- Vector DB abstraction before outcome data  
- Self-improvement theatre without events  
- Autonomous spend or code deploy without hard limits  
- Fancy dashboard before money path works  

---

## 14. Build sequence (money-first)

### Phase 1 — One commercial cell
```
Opportunity (human) → Offer (live) → Checkout (Stripe)
→ Webhook → Fulfilment → Delivery → Evidence → EconomicEvent
```

### Phase 2 — Acquisition
One channel only (email or owned social). Human OK.

### Phase 3 — Orchestrator
“What next?” answered **from state**, not vibes.

### Phase 4 — Learning
Structured experiment outcomes → Experiment 002. Not “the model reflected.”

---

## 15. Target control plane (later)

```
STATE STORE · EVENT LEDGER · EVIDENCE STORE
              ↓
     COMMERCIAL ORCHESTRATOR
              ↓
  Opportunity / Offer / Acquisition engines
              ↓
          ACTIONPASS
              ↓
     Email · Ads · Web tools
              ↓
            STRIPE → FULFILMENT → TRUTH ORACLE → OUTCOME → LEARNING
              ↓
         model-agnostic runtime + tool registry
```

---

## 16. Cross-links

| Doc | Role |
|-----|------|
| `POLSIA-DREAMLEDGER-GAP-MATRIX.md` | Component-level EXISTS/MISSING |
| `README.md` | Phase 0–3 commercial layer |
| `POLSIA-LESSONS.md` | Short lessons |
| `DO-NOT-BUILD-YET.md` | Freeze list |
| `ops/money/DO-NOW.txt` | Human acquisition today |

**One-liner:** Polsia = operational skeleton. DreamLedger = economic nervous system. Close external pay → proof → learn without self-lying first.
