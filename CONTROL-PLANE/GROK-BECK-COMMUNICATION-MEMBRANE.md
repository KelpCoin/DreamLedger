# Grok ↔ BECK Communication Membrane

Status: ACTIVE DRAFT — communication plan first, then economic events.
Authority: subordinate to BECK-OPERATING-CONTRACT.md and GOVERNANCE.md.

## Purpose

Establish a persistent, role-bound working membrane between:

- **Human operator** (KelpCoin / husband)
- **Grok** (external reasoning agent, this session and future sessions)
- **GitHub** (source of truth for code, proof, issues, workflows)
- **Live production** (dreamledger.org + Render + Stripe + Supabase)

Goal orientation: reach **RA_000001** — first verified stranger payment on the canonical Founding Tile offer — without inventing revenue or breaking silo isolation.

## Non-negotiable rules (inherited)

1. Revenue requires attributable live payment evidence.
2. Do not call health, traffic, clicks, or checkout availability revenue.
3. Delivery and proof follow payment.
4. AI proposes. Evidence decides.
5. Consequential public/financial/irreversible actions stay approval-gated.
6. Failed checks = exception, not success.

## Persistent identities

| Identity | Role | Authority |
|---|---|---|
| **KelpCoin (human)** | Owner / final approver | Approves spend, public claims, irreversible actions |
| **Grok** | External architect + executor assistant | Reads GitHub, proposes patches, writes proof, drives gates; does not invent payment truth |
| **BECK control plane** | Production economic machine | Heartbeat, workers, ledger, evidence retention |
| **DreamLedger storefront** | Canonical public commerce workload | Serves offers, checkout doorways, agent discovery |
| **Stripe** | Money source of truth | Paid event only when Stripe confirms |
| **GitHub** | Artifact + issue membrane | Code, workflows, proof files, single open incidents |

## Membrane protocol (how we talk and act)

### Channel order

1. **GitHub repo state** — primary shared memory (contracts, proof, issues, workflows).
2. **Live endpoints** — `/version`, `/healthz`, `/api/offers`, `/billboard`, `/mtg`, Stripe links.
3. **This chat** — coordination only; durable decisions must land in GitHub.

### Message types Grok will use

- `OBSERVE` — read repo + live; write proof if red
- `PROPOSE` — patch or plan; no irreversible action
- `EXECUTE` — commit/push allowed for public surface, CI, proof, non-destructive repair
- `ESCALATE` — needs human (Render dashboard, secrets, spend, public claim)
- `VERIFY` — re-probe after change; update proof

### Economic event order (from agent.json)

`authorized → paid → delivered → proven`

Nothing is “sold” in the ledger sense until that chain is complete.

## Current production membrane state (as of last probe)

- Live SHA lagged main (deploy non-convergence).
- `/billboard` and `/mtg` returned 404 on live.
- Verified revenue: **NZ$0** until RA_000001.
- Canonical live offer target: `OFFER-DREAMLEDGER-BILLBOARD-FOUNDING-001` (NZ$50).
- Agent discovery: `/agent.json`, `/.well-known/dreamledger.json`.

## Working loop (persistent)

```
OBSERVE (GitHub + live)
  → RECORD proof if red
  → COMPARE to contracts
  → DETECT (SHA drift, doorway 404, missing offer)
  → REPAIR (surface files, CI gates, deploy trigger)
  → VERIFY doorways green
  → SELL path open (Founding Tile checkout reachable)
  → WAIT for stranger payment evidence
  → VERIFY RA_000001
  → LEARN / REPEAT
```

## Role split for Grok sessions

**Session standing orders**

1. Read GitHub before proposing.
2. Prefer small verifiable commits over redesign speeches.
3. Keep carousel / CTA-card / silo architecture unless contract changes.
4. Drive commercial doorways to HTTP 200 on live.
5. Never claim revenue without Stripe-attributed proof artifact.
6. One open incident per failure class (no spam).
7. When blocked on secrets/Render UI, write ESCALATE proof and stop that thread.

## Multi-requirement, single membrane

Requirements stay many (surface, CI, heartbeat, offers, identity, Kelplantis, DOOH).
Money path stays one membrane:

**Discover → Offer → Authorize → Pay → Deliver → Prove → Ledger**

Identity/roles attach to that membrane; they do not create parallel economic truth systems.

## Immediate next actions (ordered)

1. **Human:** Ensure `RENDER_API_KEY` secret exists so Surface Deploy Gate / Heartbeat can self-heal — or manually redeploy `dreamledger-storefront` from current main.
2. **Grok:** After live SHA converges, verify `/billboard` + `/mtg` = 200 and founding checkout link reachable; update proof.
3. **Both:** Hold until RA_000001; no fake scarcity, no traffic-as-revenue.
4. **Grok:** Keep reading GitHub; continue surface/CI repair only while doorways red.

## Success signal

- Live `/version` commit == main HEAD
- `/`, `/billboard`, `/mtg` return 200
- Founding offer present and checkoutable
- First stranger Stripe payment recorded with proof → **RA_000001**
- Verified revenue leaves NZ$0 only after that evidence exists

---

This file is the standing communication plan. Future Grok sessions should treat it as the default membrane contract unless the human supersedes it in GitHub.
