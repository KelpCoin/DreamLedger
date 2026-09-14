# Kelplantis — Visitable homes, depth scarcity, real estate, in-game DOOH

**Date:** 2026-09-15  
**Status:** SPEC ACTIVE — implement in bounded increments  
**Silo:** Kelplantis gameplay + DreamLedger commerce spine for paid slots only  
**Rule:** claim = mechanism; revenue only after Stripe-attributed proof (RA path)

---

## 1. Product intent

Combine:
- **Diablo loop** — already working (town → dungeon → combat → loot)
- **Habbo loop** — visit others’ rooms, decorate, show off
- **Engineered scarcity** — deeper floors = smaller towns = fewer real-estate units
- **DreamLedger commerce** — in-game billboard / DOOH-style slots settle on the same paid → delivered → proven spine as Founding Tile

One canonical city metaphor per depth; rest of the floor is procedural dungeon. Towns shrink with depth.

---

## 2. Depth scarcity model (deterministic)

For `floor_id` in 1..100:

```
town_plot_slots(floor) = max(3, ceil(48 / sqrt(floor)))
town_map_size(floor)   = max(12, ceil(40 / sqrt(floor)))   // square edge in tiles
home_grid(floor)       = max(2, ceil(town_plot_slots / 4)) // homes along a side
billboard_slots(floor) = max(1, ceil(town_plot_slots / 8))
rent_cap_days          = 30
```

Examples:
| Floor | Town edge | Home plots | Billboard slots |
|------:|----------:|-----------:|----------------:|
| 1 | 40 | 48 | 6 |
| 4 | 20 | 24 | 3 |
| 16 | 10 | 12 | 2 |
| 49 | 6 | 7 | 1 |
| 100 | 4 | 5 | 1 |

**Scarcity is engineered and public.** Deeper = harder combat *and* fewer places to own/show.

Encoded in compiler: `KelplantisFloorProfiles.js` → `town_economy` block.

---

## 3. Hotel / home visiting mechanics

### 3.1 Entities

| Entity | Meaning |
|---|---|
| `home_id` | Stable id: `home:{floor_id}:{plot_index}` |
| `owner_player_id` | Current owner (nullable = vacant) |
| `lease` | `owned` \| `rented` \| `vacant` |
| `decor` | Palette + message (existing `kelplantis_set_home_decor`) |
| `visit_policy` | `public` \| `friends` \| `locked` |
| `presence_channel` | `kelplantis-home-{home_id}` |

### 3.2 Core player actions

1. **Enter own home** — from town pedestal / door on owned or rented plot  
2. **Knock / visit** — from town UI list or standing on plot door  
3. **Presence inside home** — same Realtime pattern as town, **scoped channel per home**  
4. **Decorate** — only owner/renter; existing RPC  
5. **Leave** — return to that floor’s town spawn  

### 3.3 RPC contracts (Supabase — Claude/engine plane)

```
kelplantis_list_homes(floor_id) -> plots[{home_id, lease, owner_name?, visit_policy, billboard?}]
kelplantis_visit_home(home_id) -> {ok, home_id, decor, visit_policy} | error if locked
kelplantis_leave_home()
kelplantis_set_home_visit_policy(home_id, policy) -- owner only
kelplantis_claim_home(floor_id, plot_index, mode) -- mode: claim_free|rent|buy (server validates scarcity + payment)
```

Visiting must be **server-authoritative**: client cannot invent access to locked homes.

### 3.4 Presence

- Town: existing channel `kelplantis-depth-{n}` (or current depth-1 channel)
- Home: **new channel per home** so visitors see each other inside the room only
- Inspect avatar works inside homes the same as town

This is the real Habbo gap close.

---

## 4. Real estate (buy / rent)

### 4.1 Rules

- Floor 1 may allow a **one free starter plot** per player (anti-hoard: one free total, not per floor)
- Deeper floors: **no free plots** — rent or buy only
- Buy = permanent for that `home_id` until abandon/transfer
- Rent = fixed term (`rent_cap_days`), auto-vacate if unpaid
- One player soft-cap: `max_owned_homes = 3` until RA-style economy proof exists

### 4.2 Money path (DreamLedger spine)

Do **not** invent a parallel ledger.

```
Game intent (claim home / rent / billboard)
  → DreamLedger offer_id created or resolved
  → Stripe checkout_url
  → webhook paid
  → fulfilment writes lease/ownership in Supabase
  → proof artifact
```

Offer families:
- `OFFER-KELP-HOME-RENT-{floor}`
- `OFFER-KELP-HOME-BUY-{floor}`
- `OFFER-KELP-BILLBOARD-{floor}-{slot}`

Prices scale with scarcity (deeper = higher), published in catalogue when checkout is enabled.

**Until checkout is live for a given offer: status = gated.** No fake “sold out” theater without inventory math.

---

## 5. In-game programmatic DOOH / billboard slots

### 5.1 What it is

Not OpenRTB SSP on day one. It is:

- Finite **billboard slots inside each floor’s town** (`billboard_slots(floor)`)
- Visible to players in that town scene
- Purchased via **DreamLedger Stripe offer** (same spine as website Founding Tile)
- Creative = URL + short label + optional image hash (human review flag optional)

### 5.2 Why this matters

Bridges `dreamledger.org` commerce **into the game**:
- Website Founding Tile = public web canvas
- Game billboard = depth-scoped, scarcity-bound, visitable audience

Same economic event order: authorized → paid → delivered → proven.

### 5.3 Delivery

On `checkout.session.completed` for a Kelplantis billboard offer:
1. Mark slot `paid_pending_review` or `live` (policy choice)
2. Write creative to `kelplantis_billboard_slots`
3. Town render reads slots for that `floor_id`
4. Proof row links Stripe event id ↔ slot id ↔ floor id

### 5.4 Honest limits

- Do not claim external pDOOH reach
- Impression counts inside game are **game telemetry**, not ad-industry currency, until a separate measurement contract exists
- OpenRTB 2.6 remains a **later** integration if a real SSP is attached

---

## 6. Town generation vs dungeon

- **One town per floor** — size from scarcity model
- **Dungeon** — existing procedural generator (unchanged core)
- Town contains: spawn, fountain/notice, **home doors** (plot grid), **billboard faces**
- Deeper towns: fewer doors, fewer boards, tighter walkable area

---

## 7. Implementation order (bounded)

| Step | Deliverable | Plane |
|------|-------------|-------|
| **A** | `town_economy` on floor profiles (scarcity numbers) | GitHub compiler ✅ |
| **B** | `kelplantis_list_homes` + vacant plots for floor 1 | Supabase |
| **C** | Visit RPC + home presence channel | Supabase + client |
| **D** | Visit policy + lock | Supabase + client |
| **E** | Wire rent/buy to gated DreamLedger offers | Catalogue + Stripe |
| **F** | Billboard slot table + town render | Supabase + client |
| **G** | Webhook fulfilment home/billboard | Engine preload pattern |
| **H** | Only then: marketing “own land on Depth N” | Human |

Grok plane this session: **A + this spec**. Supabase RPCs need the Supabase-capable agent or human.

---

## 8. Non-goals (for now)

- Full OpenRTB auction inside the game
- Unlimited player-built cities
- Cross-silo soft-currency that pretends to be NZD
- Monetizing decor cosmetics before visit loop works

---

## 9. Success criteria

1. Player A decorates home; Player B can visit and see decor + presence  
2. Floor 50 town has strictly fewer plots than Floor 1 (public formula)  
3. Billboard purchase produces Stripe payment + in-town creative + proof  
4. No revenue number moves without Stripe evidence  

---

## 10. Handoff

- Claude / Supabase agent: implement B–D against live functions  
- Grok: keep GitHub contracts, catalogue offer stubs, webhook design, scarcity compiler  
- Human: first paid home/billboard when offers ungate  
