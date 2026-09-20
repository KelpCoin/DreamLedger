# Turbine–generator design

**Date:** 2026-09-20  
**Parent:** `METAPHOR-HYDROELECTRIC-DAM.md`  
**Related:** spillway valve, figure-eight estuary, `PING_PONG_BALLS.json`

The dam stores and disciplines flow. The **turbines** convert flow into shaft work. The **generator** converts shaft work into usable exhaust. This note specifies those machines in system terms — not as art, as a build sheet.

---

## 1. Station layout (two turbines, one bus)

```
                    RESERVOIR / PENSTOCK
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
     ┌─────────────────┐       ┌─────────────────┐
     │  TURBINE A      │       │  TURBINE B      │
     │  PLAY           │       │  SETTLE         │
     │  (The Shallows) │       │  (Commerce)     │
     └────────┬────────┘       └────────┬────────┘
              │         COUPLING        │
              │    (identity / email /  │
              │     cosmetics / bus)    │
              └────────────┬────────────┘
                           ▼
                  ┌─────────────────┐
                  │    GENERATOR    │
                  │  (conversion +  │
                  │   metering)     │
                  └────────┬────────┘
                           ▼
                       EXHAUSTS
```

- **Turbine A** can spin alone (offline play) → spillway-grade output (demo, local clear).  
- **Turbine B** can spin alone (checkout without game) → money path without identity depth.  
- **Coupled** figure-eight: play creates identity surface; settle grants cosmetics/entitlements; both feed the generator’s meter only when evidence closes.

---

## 2. Turbine A — PLAY (The Shallows)

### Duty

Turn **session intent** into **completed vertical-slice events** (enter, gather, fight, clear or die) with honest local or later authoritative state.

### Hydraulic analogue → software

| Turbine part | Implementation |
|--------------|----------------|
| Inlet guide vanes | Sanctuary → Enter The Shallows (UI / scene gate) |
| Runner / blades | Grid move, kelp gather, skitter combat |
| Draft tube | Exit / death / clear → sanctuary; progress flag |
| Speed sensor | HUD: HP, fronds, kills, phase |
| Overspeed trip | Cap scope: one floor, one enemy family, no Floor 2 |

### Rated operating points (frozen)

| Parameter | Value | Source |
|-----------|--------|--------|
| Clear fronds | 6 | encounters JSON / browser / Godot |
| Clear kills | 5 | same |
| Player max HP | 10 | same |
| Skitter HP / dmg | 8 / 2 | same |
| Player hit dmg | 3 | same |

### Shaft outputs (what A delivers downstream)

- `session_events` (enter, gather, kill, death, clear)  
- `identity_surface` (avatar link, optional email, cosmetic hooks)  
- `local_or_authoritative_progress` (localStorage / Godot user:// today; RPC later)  

### Not Turbine A’s job

- Mint currency, grant paid power, declare Stripe revenue, host multiplayer authority alone.

### Build states

| State | Artifact |
|-------|----------|
| Commissioning / spill | `phinhaven/shallows/index.html`, Godot scaffold |
| Grid-ready (later) | Live `kelplantis_*` bind + hosted client |

---

## 3. Turbine B — SETTLE (commerce)

### Duty

Turn **external purchase intent** into **settled, attributed, entitled, proven** economic events.

### Hydraulic analogue → software

| Turbine part | Implementation |
|--------------|----------------|
| Inlet | Catalog SKU + public checkout URL |
| Runner | Stripe Checkout / PaymentIntent |
| Governor | Webhook signature verify, idempotent event_id |
| Draft tube | Entitlement row + fulfillment + fossil |
| Trip | Reject unverified, duplicate, or unattributed events |

### Rated operating points (priority load)

From money handoffs — do not dilute until first stranger pays:

| SKU class | Target NZ$ | Role |
|-----------|------------|------|
| Billboard tile | 50 | Highest contribution |
| Diagnostic | 29 | Volume / intent |
| Discord kit | 79 | High margin if auto digital delivery |

### Shaft outputs (what B delivers downstream)

- `payment_intent.succeeded` (external)  
- `attribution` (SKU, customer ref, session/avatar email if any)  
- `entitlement` (cosmetics/tiers only for game-facing grants)  
- `fossil` (evidence package)  

### Not Turbine B’s job

- Simulate payments as live revenue, auto-trade TCG, treat game clears as cash.

### Build states

| State | Meaning |
|-------|---------|
| Machinery present | Stripe rail + catalog paths in DreamLedger ecosystem |
| Under load | First verified external settlement |
| Metered | `verified_external_revenue_nzd > 0` with fossil |

---

## 4. Coupling (the figure-eight shaft link)

Without coupling, you have two separate hobby turbines. With coupling, play and settle wash each other:

| Coupling signal | Direction | Rule |
|-----------------|-----------|------|
| Avatar name / email | A → B | Optional match to Stripe customer email |
| Entitlement / cosmetic ids | B → A | Tint or unlock presentation only |
| Tier keys (supporter, founder, …) | B → A | No combat power |
| AGENT_BUS handoffs | both | Next LLM inherits both lobes |
| Clear / progress | A only unless productized | Must not invent cash |

**Mechanical rule:** coupling transmits **identity and rights**, not fabricated torque (fake money or client-authoritative economy).

---

## 5. Generator — conversion and metering

The generator is not a third product app. It is the **conversion layer + meter**:

```
Shaft work (A events + B settlements)
        →  evidence contract
        →  exhaust ports
        →  published meter readings
```

### Stator / windings (what must be wired)

1. **Evidence schema** (bridge + DreamLedger commercial path)  
2. **Idempotent webhook handling**  
3. **Fossil packaging** (hashable proof of chain)  
4. **Status publication** (`figure-eight-status.json`, AGENT_BUS meter fields)  

### Nameplate meter

| Reading | Meaning |
|---------|---------|
| `verified_external_revenue_nzd` | Only after full chain |
| `playable_demo` | Spill or exhaust of attention — separate from money |
| `canonical_runtime` | Godot/browser production host status |

**Generator law:** no excitation from fantasy. Field current = verified events only.

---

## 6. Governor and protection

| Device | Function |
|--------|----------|
| **Dam / evidence gate** | Blocks false exhaust |
| **Spillway** | Labeled offline/design discharge under pressure |
| **Overspeed (scope trip)** | No Floor 2, no 100 SKUs before first settlement |
| **Reverse power relay** | Reject treating internal TEST as external revenue |
| **Sync check** | GitHub and Supabase agents leave handoffs before claiming bus sync |

---

## 7. Exhaust bus design

| Port | Fed primarily by | Grid-ready when |
|------|------------------|-----------------|
| Money | Turbine B + generator meter | Fossil exists |
| Playable demo | Turbine A (even offline) | URL or file path works |
| Cosmetics | B entitlement → A presentation | Row + client read path |
| Alerts (TCG etc.) | Separate small turbine later | Policy gate + ledger |
| Fossils | Generator | Every real settlement packaged |

Money is **one port on the exhaust bus**, prioritized for commissioning, not the only winding.

---

## 8. Commissioning sequence (engineering order)

1. **Spin A offline** — done (browser; Godot scaffold).  
2. **Label spill** — done (PROOF + AGENT_BUS).  
3. **Pressurize B inlet** — live SKUs + checkout reachable.  
4. **First load on B** — stranger `payment_intent.succeeded`.  
5. **Close generator circuit** — entitlement + fossil + meter > 0.  
6. **Tighten coupling** — email/avatar ↔ entitlement on real pays.  
7. **Authoritative A** — RPC bind when runtime recovered.  

Skipping to “more blades on A” (Floor 2) before step 4–5 is polishing a turbine that is not yet on the grid.

---

## 9. Design constraints (nameplate)

- Single-player vertical slice before multiplayer netcode.  
- Cosmetics/titles only from paid or membership path — no pay-to-win torque.  
- Client never self-certifies production clear or production payment.  
- Game activity is not DreamLedger business revenue.  
- One hand washes the other via AGENT_BUS, not via silent assumptions.

---

## 10. One sentence

**Turbine A turns play into identity-bearing events; Turbine B turns purchase into settled rights; the generator only meters what the evidence gate admits — and money is one exhaust port on that bus, commissioned when real flow finally loads the shaft.**
