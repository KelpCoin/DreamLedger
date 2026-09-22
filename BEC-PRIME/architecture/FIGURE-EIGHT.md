# Figure-eight architecture — BEC / DreamLedger

**Canonical machine reading of the hydroelectric / estuary metaphor.**  
Companions: `AGENT_BUS/HANDOFF-2026-09-20-FIGURE-EIGHT-ESTUARY.md`, `AGENT_BUS/METAPHOR-HYDROELECTRIC-DAM.md`, `PING_PONG_BALLS.json`.

---

## 1. Shape

Two lobes, one crossing, one dam, multiple exhausts.

```text
                    ┌─────────────────────────────────────┐
                    │           AGENT_BUS (crossing)        │
                    │  handoffs · PING_PONG_BALLS · bridge  │
                    └───────────────┬─────────────────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              │                     │                     │
              ▼                     │                     ▼
     ┌─────────────────┐            │            ┌─────────────────┐
     │   PLAY LOBE     │            │            │  SETTLE LOBE    │
     │                 │            │            │                 │
     │ Phin Haven      │──identity──┤            │ Catalog/offers  │
     │ Social / dive   │            │            │ Stripe checkout │
     │ Cosmetics UI    │◀─entitle───┤            │ Webhook penstock│
     │ (not revenue)   │            │            │ Performance Wall│
     └─────────────────┘            │            │ Fossils / meter │
              │                     │            └────────┬────────┘
              │                     │                     │
              └──────── evidence ───┴──── DAM ────────────┘
                                    │
                              EXHAUSTS
                     money · demo · tiers · fossils
```

---

## 2. Lobes

### Play lobe (Turbine A)

| Element | Role |
|---------|------|
| Surfaces | Phin Haven social-first, optional dive, avatar/cosmetics UI |
| Output | Attention, identity, retention |
| **Not** | Business revenue |

### Settle lobe (Turbine B)

| Element | Role |
|---------|------|
| Offer | Approved catalog only |
| Pay | Stripe live Checkout / Payment Link |
| Penstock | Signed Stripe webhook → fulfilment adapter |
| Default fulfil | **Performance Wall** (key → cubby → claim → TTL) |
| Special fulfil | Billboard grid, MTG diagnostic, etc. when registry says so |
| Meter | Settlement Sync + fossil only |

### Crossing (bus)

GitHub `AGENT_BUS/` + optional Supabase/bridge workers.  
Agents leave **ping-pong balls** so the other side does not cold-start.

### Dam

No `verified_external_revenue_nzd` without:

external buyer → live paid session → attribution → fulfilment evidence → fossil.

---

## 3. Control laws

1. Potential (code, handoffs) ≠ power (cash).  
2. Play water and settle water may share identity; they must not share fake meters.  
3. Ball **C** (first external sale) outranks Floor 2 expansion.  
4. Spillway (docs, demos, air-gap design) is allowed; it is not the generator.  
5. Write continuity to git; chat is not the bus.

---

## 4. Exhaust ports

| Exhaust | Gate |
|---------|------|
| Money | Ball C chain closed |
| Playable demo | Browser / hosted path |
| Cosmetics tiers | Entitlement after pay or policy |
| Fossils | Every real settlement |

---

## 5. Relation to Performance Wall

Most digital SKUs should **not** require bespoke fulfilment arms.  
Settle lobe default path:

**pay → webhook → mint key → open cubby → buyer claims → wall seals after TTL.**

Special products (finite billboard pixels, physical dispatch) keep specialized arms in `PRODUCT-FULFILLMENT-REGISTRY.json`. Everything else prefers the wall.

See `BEC-PRIME/fulfillment/PERFORMANCE-WALL.md`.
