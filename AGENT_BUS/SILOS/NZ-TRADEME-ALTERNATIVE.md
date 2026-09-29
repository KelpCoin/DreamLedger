# NZ Silos — MTG primary · Retro games · Vinyl (Trade Me alternative)

**Written:** 2026-09-30  
**Goal:** Low-overhead NZ marketplace lanes that beat Trade Me on **fees clarity + specialised verticals**, not by cloning all of Trade Me on day one.  
**CUBE rule:** paid → verified → clone.  
**Host note:** dreamledger.org was Service Suspended (503) at write time.

---

## Positioning vs Trade Me

| Trade Me pain (typical) | DreamLedger lane |
|-------------------------|------------------|
| Success fees on sales | **0% platform success fee** on listed public offers (Stripe processing separate) |
| Generalist listings | **Specialist silos**: MTG, retro, vinyl — trust via category depth |
| Auction + classified noise | Start with **fixed buy routers** + optional auction later |
| National general audience | **NZ-first** copy, NZD, local pickup/shipping norms |

**Do not claim “we replaced Trade Me” until volume exists.** Claim: *better lane for cards, retro, and vinyl.*

---

## Silo 1 — `mtg` (PRIMARY)

**Already live ignition**

| product_id | Role | NZD |
|------------|------|-----|
| `COMMANDER-DECK-DIAGNOSTIC-001` | Digital diagnostic (confession / service) | 29 |
| `EDH_0001` | Physical commander deck | 400 |

**Populate next (planned — need Stripe links)**

| product_id | Name | NZD | Notes |
|------------|------|-----|--------|
| `MTG-SINGLE-LISTING-SLOT-001` | Seller listing slot (30 days) | 5 | Fee-for-listing, not success % |
| `MTG-COLLECTION-AUDIT-001` | Binder / collection audit | 39 | Parallel seller audit skill |
| `MTG-WANT-LIST-MATCH-001` | Want-list match report | 15 | Digital fulfil |
| `MTG-LOCAL-PICKUP-PASS-001` | Local NZ meetup pass | 9 | Sanctum-style |
| `MTG-LGS-PARTNER-KIT-001` | LGS partner kit | 79 | Discord kit cousin |

**Distribution:** NZ EDH Facebook, Discord, LGS counters, uni clubs.  
**Trade Me wedge:** “No success fee on the diagnostic; transparent NZD; specialist not generalist.”

---

## Silo 2 — `retro_games`

**NZ retro / vintage console & handheld lane**

| product_id | Name | NZD | Notes |
|------------|------|-----|--------|
| `RETRO-CONDITION-REPORT-001` | Condition & authenticity report | 29 | Same fulfilment pattern as diagnostic |
| `RETRO-LISTING-SLOT-001` | Seller listing slot 30d | 5 | Listing fee model |
| `RETRO-BUNDLE-GUIDE-001` | NZ price guide PDF (monthly) | 12 | Digital |
| `RETRO-SELLER-AUDIT-001` | Seller profit vs Trade Me fees | 29 | Reuse seller-audit narrative |
| `RETRO-LOCAL-MEET-001` | Local swap-meet pass | 9 | Event |

**Bootstrap until Stripe:** point buyers at `SELLER-PROFIT-AUDIT-001` (fee pain) + `COMMANDER-DECK-DIAGNOSTIC-001` only as *process demo*, not as retro product.

**Distribution:** NZ retro Facebook groups, Trade Me watchers tired of fees, Trademe “Gaming” refugees.

---

## Silo 3 — `vinyl` (music media)

**NZ vinyl / physical music media lane**

| product_id | Name | NZD | Notes |
|------------|------|-----|--------|
| `VINYL-CONDITION-GRADE-001` | Sleeve/disc grade report | 19 | Digital after photos |
| `VINYL-LISTING-SLOT-001` | Seller listing slot 30d | 5 | Listing fee |
| `VINYL-COLLECTION-AUDIT-001` | Collection value audit | 39 | |
| `VINYL-WANT-LIST-001` | Want-list hunter report | 15 | |
| `VINYL-PRESSING-ID-001` | Pressing identification help | 12 | |

**Bootstrap:** `SELLER-PROFIT-AUDIT-001` for sellers comparing Trade Me fees; billboard for local record-fair promo later.

**Distribution:** NZ vinyl groups, record fairs, Auckland/Wellington/Christchurch collectors.

---

## Shared NZ marketplace mechanics (all three silos)

1. **Listing fee not success fee** — $5 slot SKUs teach the model before full classifieds.  
2. **Service SKUs first** (diagnostic, condition report, audit) — digital, instant margin, no inventory.  
3. **Physical later** — only after proof of paid demand.  
4. **0% platform success fee** on public offers; Stripe fees disclosed.  
5. **Horizontal shop rails** — one rail per silo when host is up.  
6. **B2B** — LGS / record shop partner kits (NZ$79 pattern).

---

## Economic loop (same spine)

```
DISCOVER NZ group / LGS / fair
  → OFFER /buy/{id} or listing slot
  → PAY Stripe NZD
  → FULFIL digital report or activate slot
  → PROOF Stripe + delivery
  → REPEAT upsell audit / member / physical
```

### This week (Ball C) — MTG first

1. Restore host if still suspended.  
2. Push **Commander Deck Diagnostic NZ$29** in NZ MTG groups (primary cash).  
3. Message sellers: “Trade Me fee math → Seller Profit Audit NZ$29”.  
4. Only then open Stripe products for `RETRO-CONDITION-REPORT-001` and `VINYL-CONDITION-GRADE-001`.

---

## What not to do

- Boil the ocean (full Trade Me clone).  
- Invent checkout URLs without Stripe.  
- Neglect MTG (primary) for vinyl/retro theory.  
- Claim market takeover without GMV evidence.

---

## File index

- This doc: `AGENT_BUS/SILOS/NZ-TRADEME-ALTERNATIVE.md`  
- Machine: `AGENT_BUS/SILOS/nz-trademe-silos.json`  
