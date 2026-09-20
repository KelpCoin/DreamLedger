# Hydroelectric dam metaphor — mapped to the working system

**Date:** 2026-09-20  
**Companion:** `HANDOFF-2026-09-20-FIGURE-EIGHT-ESTUARY.md`, `PING_PONG_BALLS.json`

This is not poetry for its own sake. It is a **control model**: what must be full, what must turn, what may spill, and what must never be claimed as power until the turbine has actually spun under load.

---

## 1. The landscape

```
  HEADWATERS (attention, design, LLM sessions, local PC)
           │
           ▼
    ~~~~~~~~~~~~~~~~
    |  RESERVOIR   |   ← AGENT_BUS, GitHub, Supabase, PROOF, design data
    |  (stored     |
    |   potential) |
    ~~~~~~~┬~~~~~~~~
           │ PENSTOCK (pipelines: handoffs, RPCs, webhooks, CI)
           ▼
      ╔══════════╗
      ║   DAM    ║   ← Evidence gate (BusinessTruth / fossil contract)
      ╚════╤═════╝
           │
     ┌─────┴─────┐
     │  TURBINES │   ← Play loop + Settle loop (figure-eight)
     └─────┬─────┘
           │
     EXHAUSTS / TAILRACE
        ├── Money (Stripe settlement)     ← required soon, not claimed early
        ├── Playable demo / proof of game
        ├── Cosmetics / community tiers
        ├── Alerts (TCG etc.)
        └── Fossils / audit trail
           │
           ▼
        ESTUARY → OCEAN (public world, customers, other agents)
```

The **figure-eight** is the water path through the powerhouse: one lobe play, one lobe settle, crossing at the bus. The **dam** is not the generator — it is the structure that forces water through the turbines instead of leaking as unearned claims.

---

## 2. Parts → system

| Metaphor | System meaning | Current state (honest) |
|----------|----------------|-------------------------|
| **Headwaters** | Human intent, LLM turns, local Godot/PC, ideas | Flowing when someone shows up |
| **Reservoir** | Durable state: git, AGENT_BUS, schemas, browser/Godot assets | Partially filled; playable Shallows + scaffold + handoffs |
| **Penstock** | Channels that carry work: commits, handoffs, Supabase RPCs, Stripe webhooks, bridge workers | Built in places; not all pressurized |
| **Dam wall** | Evidence rules: no revenue claim without full chain | Standing — NZ$0 verified external |
| **Spillway** | Safe overflow when pressure is high but turbine not ready: design docs, offline demos, air-gap specs | In use (PROOF/airgap, browser MVP) |
| **Turbine A (play)** | Enter floor → gather/fight → clear/die → identity | Spinning offline (browser); Godot scaffold ready |
| **Turbine B (settle)** | Offer → checkout → webhook → entitlement → fossil | Machinery present; **no load from a stranger payment yet** |
| **Generator** | Conversion of flow into usable exhaust | Not yet producing verified money |
| **Tailrace / exhausts** | Outputs that leave the plant | Demo yes; money not yet |
| **Estuary** | Meeting of internal loop and public world | Soft — needs one real buyer to prove the mouth |
| **Ocean** | External demand, other LLMs, customers | Not controlled by us; we only open channels |

---

## 3. Laws of the dam (operating rules)

1. **Potential ≠ power**  
   A full reservoir (code, design, handoffs) is not electricity. Claiming revenue from design is claiming megawatts from still water.

2. **The dam exists so flow is forced through work**  
   Without the evidence gate, water (hype, TEST payments, simulated activity) spills as false exhaust. The dam is discipline, not blockage for its own sake.

3. **Spillway is legitimate**  
   Offline demos, Godot scaffolds, TCG alert *design*, tier *schemas* — these relieve pressure and keep the site safe while turbines are commissioned. They are not the generator output.

4. **One hand washes the other = recirculation**  
   Tailrace water can be pumped back toward the reservoir only as **proof and entitlements** (cosmetics, clear flags, fossils) — not as invented cash. GitHub agents fill what Supabase agents release, and vice versa.

5. **Money is one exhaust, not the river**  
   The river is attention + proof + loop completion. Money is a turbine product. Required soon. Not the definition of “water present.”

6. **Pinball / ping-pong balls = load pulses**  
   Small balls (A–E) are controlled releases through the penstock so the next agent receives kinetic work, not a stagnant lake.

---

## 4. What “hydroelectric” demands operationally

To get **power in the pocket** (money exhaust):

1. **Head** — real external attention on an offer (not only internal play).  
2. **Flow through penstock** — live checkout path that actually reaches Stripe.  
3. **Turbine under load** — `payment_intent.succeeded` for a stranger.  
4. **Governor / dam instrumentation** — attribution, entitlement, fulfillment, fossil written.  
5. **Meter reading** — only then raise `verified_external_revenue_nzd` above 0.

Until step 3–5, the plant is **commissioning**: reservoirs and spillways are working; the generator is not yet on the grid.

---

## 5. Failure modes (dam engineering)

| Failure | Meaning in system |
|---------|-------------------|
| **Overtopping** | Shipping claims faster than evidence — reputation flood |
| **Silted reservoir** | AGENT_BUS / PROOF never read; every LLM dredges from zero |
| **Blocked penstock** | Handoffs not written; GitHub and Supabase agents cannot pass water |
| **Turbine without dam** | Client-authoritative “clear” or fake payments treated as truth |
| **Dam without turbine** | Endless process, zero exhaust — pure bureaucracy |
| **Closed ocean gates** | No distribution; perfect plant, no river mouth |

---

## 6. Figure-eight as the powerhouse floor plan

The figure-eight is **not** a second river. It is how water is routed across two turbines in one station:

- **Upper loop (play):** identity, session, clear, cosmetics surface  
- **Lower loop (settle):** SKU, Stripe, webhook, entitlement  
- **Crossing:** AGENT_BUS + bridge — the shared gallery where one LLM leaves kinetic energy for another  

Estuary = where tailrace meets salt water (public customers). Hydroelectric dam = the station that makes that meeting *powered* instead of a muddy uncontrolled flood.

---

## 7. For the next agent

When you read this metaphor, translate immediately to:

- Fill **reservoir** only with durable commits (not chat).  
- Send **ping-pong balls** down the penstock (`PING_PONG_BALLS.json`).  
- Respect the **dam** (no revenue claim without chain).  
- Prefer **commissioning a turbine** (Ball C money, or live RPC bind) over raising the spillway walls higher.  
- Measure **exhaust**, not intention.

---

## 8. One sentence

**The reservoir is what we have stored; the dam is what we refuse to fake; the turbines are play and settle; money is one exhaust when real flow finally turns the shaft.**
