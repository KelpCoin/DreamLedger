# Spillway safety valve — examination

**Date:** 2026-09-20  
**Parent metaphor:** `METAPHOR-HYDROELECTRIC-DAM.md`  
**Bus:** `PING_PONG_BALLS.json`, figure-eight handoff

---

## 1. What a spillway is for

On a real dam, the spillway is a **controlled overflow path**. When the reservoir rises faster than the turbines can take, water leaves **without** destroying the dam wall or flooding the valley at random.

In this system the spillway is the same idea:

| Without spillway | With spillway |
|------------------|---------------|
| Pressure (ideas, LLM output, scope) has nowhere safe to go | Excess becomes **labeled, non-claiming** artifacts |
| Agents invent revenue or “done” to relieve anxiety | Agents write demos, schemas, handoffs marked as design/offline |
| Dam wall cracks (false BusinessTruth) | Dam wall stays closed until real load |
| Or work freezes (dam without turbine) | Commissioning continues under safe discharge |

**Safety valve** = permission to release energy **without** calling it generator output.

---

## 2. What the valve protects

1. **The dam (evidence gate)**  
   Stops TEST, SIMULATED, local clears, and design docs from being promoted to verified revenue or production authority.

2. **The reservoir (continuity)**  
   Spill is still *captured* (git, AGENT_BUS, PROOF) so the next agent inherits structure instead of a silent flood of chat.

3. **The operator**  
   Allows stepping away without either (a) fake money claims or (b) total freeze until Godot/Stripe are perfect.

4. **The turbines’ reputation**  
   Play and settle loops are not blamed for not yet producing grid power while they are still being commissioned.

---

## 3. Inventory — what is currently on the spillway

These are **legitimate spill**, not turbine exhaust:

| Channel | Path / artifact | Valve label |
|---------|-----------------|-------------|
| Browser Floor 1 demo | `phinhaven/shallows/index.html` | PLAYABLE_OFFLINE · not production authority |
| Godot scaffold | `phinhaven/godot/shallows/` | SCAFFOLD · not canonical recovered runtime |
| Encounter / loop data | `PROOF/airgap/*.json` | DESIGN_DATA |
| Session log simulator | `PROOF/airgap/shallows_session_simulator.html` | RULES_DEMO |
| Tier / entitlement sketches | `PROOF/airgap/phinhaven_tier_entitlement_schema.sql` | SCHEMA_SKETCH · cosmetics only |
| TCG arbitrage spec | `PROOF/airgap/tcg_arbitrage_pipeline_spec.json` | ALERTS_DESIGN · no auto-trade |
| Godot integration explore | `PROOF/2026-09-20-GODOT-CLIENT-INTEGRATION-EXPLORE.md` | RECON |
| MVP distance honesty | `PROOF/2026-09-19-MVP-DISTANCE-HONEST.md` | STATUS |
| Figure-eight + balls | `AGENT_BUS/HANDOFF-2026-09-20-*`, `PING_PONG_BALLS.json` | BUS_CONTINUITY |
| Dam metaphor | `AGENT_BUS/METAPHOR-HYDROELECTRIC-DAM.md` | CONTROL_MODEL |
| Bridge figure-eight status | `llm-supabase-github-bridge/docs/figure-eight-status.json` | NZ$0 explicit |

**Rule of labeling:** every spillway discharge should carry a status that a future LLM cannot mistake for generator output (`design_only`, `offline`, `scaffold`, `verified_external_revenue_nzd: 0`, etc.).

---

## 4. How the safety valve opens and closes

### Opens (healthy) when

- Turbines are not ready (no stranger payment, no live RPC, no Godot import) **and** headwater pressure is high (active LLM/human sessions).
- Output is written to disk with an honest non-claim label.
- Ping-pong balls still point at **penstock work** (Ball C money, Ball B authority), not only at more spillway height.

### Must close / throttle when

- Spill becomes the **only** activity for a long period while Ball C is ignored → plant becomes ornamental.
- Labels are dropped (“we have a game” / “we have revenue” without evidence).
- Spillway artifacts are treated as **substitutes** for penstock (e.g. localStorage clear treated as production clear).

### Stuck-open failure

Endless PROOF docs and demos, zero attempt at live checkout or live authority.  
Reservoir looks full; generator still dark; operator still has empty pockets.

### Stuck-closed failure

No demos, no scaffolds, no handoffs — only “wait for perfect Godot/Stripe.”  
Pressure either freezes the project or overtopps the dam as fantasy claims.

**Healthy valve:** intermittent open for labeled overflow; primary effort still on penstock → turbines.

---

## 5. Spillway vs exhaust (do not confuse)

| | Spillway discharge | Turbine exhaust |
|--|--------------------|-----------------|
| **Money** | Pricing docs, offer lists, “money MVP” handoffs | Settled Stripe + fossil |
| **Game** | Offline browser/Godot scaffold, design JSON | Authoritative clear + hosted runtime (later) |
| **Identity** | localStorage avatar, schema sketches | Entitlement row tied to payment/membership |
| **Alerts** | Pipeline spec, offline scorer | Live alert with gate + ledger under policy |

Spillway answers: *“We did not waste the session; we stored safe potential.”*  
Exhaust answers: *“The shaft turned under external load.”*

---

## 6. Safety valve checklist (for any agent)

Before writing a large new artifact, ask:

1. **Is this spill or exhaust?** Label it.  
2. **Does this relieve pressure without lying?** If it implies revenue or production authority, stop — that is overtopping.  
3. **Does a ping-pong ball still point at a turbine?** If every ball is “write more design,” the valve is stuck open.  
4. **Is the artifact on the bus?** Chat-only relief is an *uncontrolled* leak, not a spillway.  
5. **Would a stranger’s payment still be required after this?** If yes, good. If this artifact tries to remove that requirement, the dam is compromised.

---

## 7. Current verdict

| Aspect | Verdict |
|--------|---------|
| Spillway present? | **Yes** — demos, scaffolds, PROOF, AGENT_BUS |
| Labels mostly honest? | **Yes** — NZ$0, design_only, offline, scaffold |
| Dam still holding? | **Yes** — no verified revenue claim in status files |
| Valve stuck open? | **Risk rising** if money Ball C stays untouched while only spill accumulates |
| Valve stuck closed? | **No** — playable path and handoffs exist |
| Recommended bias now | Prefer **one penstock action** (live offer path / first settlement / RPC bind) over another spillway wall raise |

---

## 8. One sentence

**The spillway safety valve lets us discharge design and demos under pressure without cracking the evidence dam — but if it stays the only open path, the plant never generates, and the valley still waits for power.**
