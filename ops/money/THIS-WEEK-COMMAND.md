# THIS WEEK — monetization command card

**Audience:** operator (husband) + any LLM on the bus.  
**Ambition:** first external settle this week if distribution fires; infrastructure is ready enough.  
**Truth:** `verified_external_revenue_nzd = 0` until live stranger pay + settlement recognition + fulfilment + fossil.

Do not expand products. **Sell what is live. Align links. Post. Close the loop.**

---

## North targets (ambition ladder)

| Horizon | Target | Definition of done |
|---------|--------|--------------------|
| **48 hours** | Demand in market | ≥3 owned-channel posts live with correct URLs |
| **This week** | First external NZ$ | ≥1 live paid session, not self-pay, not test mode |
| **14 days** | Repeatability | ≥3 external pays OR ≥NZ$150 settled across sessions |
| **30 days** | Thin engine | One passive digital SKU live behind Performance Wall + weekly post cadence |

Architecture work is **blocked** until the 48h row is green unless it unblocks posting or settlement alignment.

---

## Primary weapons (use these, not the backlog)

### Weapon A — Founding Billboard Tile · NZ$50

| Field | Value |
|-------|--------|
| Public router | `https://dreamledger.org/buy/DREAMLEDGER-BILLBOARD-FOUNDING-001` |
| Store | `https://dreamledger.org/?src=dist` |
| Story | Permanent 100×100 on a public internet canvas; title + link at checkout; review before publish; **0% DreamLedger success fee** on the listing |
| Buyer | Founders, NZ builders, creators, people who buy weird permanent web real-estate |
| Fulfilment | Specialized billboard path (allocate → review → publish) |

### Weapon B — Commander Deck Diagnostic · NZ$29

| Field | Value |
|-------|--------|
| Public router | `https://dreamledger.org/buy/COMMANDER-DECK-DIAGNOSTIC-001` |
| Story | Structure, weak points, cuts, upgrade priorities; delivered after pay |
| Buyer | EDH players who already theorycraft |
| Fulfilment | Digital report (+ Performance Wall key when wired) |

**Catalog / settlement authority** lives in `BEC-PRIME/catalog/offers/approved.json` and `ops/commerce/README.md`.  
**Known risk:** live `/buy` and billboard page have used **different** Stripe Payment Link IDs than the approved catalog. **Before celebrating a sale as “on the meter,” align plinks** (see `SETTLEMENT-LINK-ALIGNMENT.md`).

---

## Day-by-day (this week)

### Day 0 — Align (60–90 min)

1. Open Stripe → Payment Links → note live URL for tile and diagnostic.  
2. Make **one** plink per SKU the canonical public destination.  
3. Ensure `settlement-read` has live `STRIPE_SECRET_KEY`; run **Commerce Settlement Sync** once → expect pre-sale `0`.  
4. Fill checklist in `SETTLEMENT-LINK-ALIGNMENT.md`.

### Day 1 — Blitz (both weapons)

Post **tile** on 2 channels, **diagnostic** on 1 MTG-relevant owned channel.  
Use copy from `DEMAND-KIT.md`. No ops language in posts.

### Day 2–3 — Warm path

- 5 personal messages to people who already know the project (not spam strangers cold).  
- One follow-up on the strongest channel.  
- Screenshot posts into `ops/money/evidence/demand/` if you keep local proof (optional).

### Day 4–5 — Observe + close

- If pay arrives: follow `POST-SALE-PROTOCOL.md` same day.  
- If not: one new angle post (gift tile / “founding cohort”) not a new SKU.

### Day 6–7 — Review

- Update `AGENT_BUS/PING_PONG_BALLS.json` via an agent or hand: posts done Y/N, pays 0/N, blockers.  
- Only if ≥1 fossil: schedule **one** passive SKU from `PASSIVE-SKUS-201-230.md`.

---

## Hard rules

1. No self-purchase counted as revenue.  
2. No test-mode counted as revenue.  
3. No “we could make money if…” as a status update.  
4. No 10 new products this week.  
5. Public posts = customer English only.

---

## Files in this pack

| File | Role |
|------|------|
| `THIS-WEEK-COMMAND.md` | This card |
| `DEMAND-KIT.md` | Ready-to-send posts (multi-channel) |
| `SETTLEMENT-LINK-ALIGNMENT.md` | Plink / meter / router checklist |
| `POST-SALE-PROTOCOL.md` | First dollar → fossil |
| `AMBITION-14-DAY.md` | After first sale ladder |
| `OPERATOR-SCOREBOARD.md` | Tick boxes |

**Start:** Day 0 alignment, then Day 1 blitz.
