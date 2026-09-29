# Crypto TCG Church — Silo Pack

**Written:** 2026-09-30  
**Rule:** CUBE = paid verified then clone. Use existing `/buy/{id}` until new Stripe links exist.  
**Note:** dreamledger.org was **Service Suspended (503)** at write time — ship to GitHub; redeploy when host is back.

---

## Concept

**Crypto TCG Church** = congregation around trading-card culture + crypto-native collectibles + shared “gospel” of fair play, provenance, and settlement truth.

Not a religion product. **Church** = community metaphor: weekly rites (releases), tithes (micro-purchases), scripture (rules/meta reports), confession (deck diagnostics), cathedral (horizontal catalogue rails).

### Infrastructure already there (reuse, don’t rebuild)

| Existing | Role for TCG Church |
|----------|---------------------|
| Silo `mtg` + `COMMANDER-DECK-DIAGNOSTIC-001` | Confession booth — NZ$29 ignition |
| `EDH_0001` | High-ticket relic (physical deck) |
| Horizontal `/shop.html` rails | Cathedral nave — swipe by silo |
| `/buy/{product_id}` + Stripe | Tithe plate |
| `agent-commerce.json` + `/api/offers` | Agent-readable hymn book |
| Agent bridge toll model | Gate for bot congregations |
| CUBE `paid_verified_then_clone` | New pews only after first paid proof |
| Billboard / media silo | Street pulpit (QR → buy) |

---

## Three new silos

### 1. `tcg_church` — Congregation & membership

**Purpose:** Human community, membership passes, weekly digital “sermons” (meta notes), supporter ranks.

| product_id | Name | Price NZD | Notes |
|------------|------|-----------|--------|
| `TCG-CHURCH-SEEKER-001` | Seeker Pass (7-day) | 3.99 | Mirror Sprout friction; lowest yes |
| `TCG-CHURCH-MEMBER-001` | Member month | 19 | Discord role + weekly note |
| `TCG-CHURCH-ELDER-001` | Elder quarter | 49 | Priority diagnostic queue signal |
| `TCG-CHURCH-TITHE-001` | Freewill tithe | 5 | Pure support SKU |

**Bootstrap until Stripe links exist:** sell `DREAMMEEZ-SUPPORTER-SPROUT` / `KELP-FLOOR1-001` as temporary stand-ins; fulfil as Church access manually.

**First paid proof target:** one Seeker or Member payment → clone more Member surfaces.

---

### 2. `crypto_tcg` — Digital card & pack commerce

**Purpose:** Crypto-adjacent TCG digital goods (PDF lists, pack open sims, provenance reports) — **not** claiming on-chain NFTs until real mint infra exists.

| product_id | Name | Price NZD | Notes |
|------------|------|-----------|--------|
| `CRYPTO-TCG-PACK-SIM-001` | Digital pack sim + checklist | 9 | Instant digital fulfil |
| `CRYPTO-TCG-PROVENANCE-001` | Card provenance report | 29 | Parallel to diagnostic |
| `CRYPTO-TCG-BINDER-AUDIT-001` | Collection value audit | 39 | Seller-tools cousin |
| `CRYPTO-TCG-SET-GUIDE-001` | Set guide PDF | 12 | Evergreen content |

**Bootstrap:** route curiosity to `COMMANDER-DECK-DIAGNOSTIC-001` (same skill: assess a list).

**Honest boundary:** no fake “minted on chain” claims. Optional later: DON/price oracle research for card market marks.

---

### 3. `sanctum` — Events, clinics, local rites

**Purpose:** Live/Zoom services — clinics, draft nights, church-style “service” tickets.

| product_id | Name | Price NZD | Notes |
|------------|------|-----------|--------|
| `SANCTUM-CLINIC-30-001` | 30-min deck clinic | 15 | Manual Stripe link OK |
| `SANCTUM-SERVICE-TICKET-001` | Community service ticket | 10 | Event entry |
| `SANCTUM-HOST-KIT-001` | Host kit for LGS night | 79 | Parallel Discord kit |

**Bootstrap:** `DISCORD-WEBHOOK-STARTER-KIT-001` for community ops; diagnostic for one-to-one rite.

---

## Economic loops (Church edition)

```
DISCOVER  →  shop rail / Discord / LGS QR
OFFER     →  /api/offers + agent-commerce
AUTHORIZE →  human pays
PAY       →  Stripe livemode
SETTLE    →  settlement sync
FULFIL    →  digital delivery or calendar booking
PROOF     →  Stripe ref + delivery hash/note
LEARN     →  which silo converted
REPEAT    →  upsell Member / clinic / pack
```

**Ignition order (cash before architecture):**

1. Push existing **NZ$29 diagnostic** as “Confession: deck diagnostic”  
2. Push **NZ$3.99 Sprout** as “Seeker tithe”  
3. After first livemode $ → create real Stripe links for `TCG-CHURCH-MEMBER-001`  
4. Clone shop rail section `tcg_church` + `crypto_tcg` + `sanctum`

---

## Agent bridge hooks

- Agents discover Church SKUs via `/api/offers` once published  
- Toll road: agent bulk scrape of Church catalogue metered later  
- Gauntlet: human approval before high-value `EDH_0001` or physical fulfil  
- Do **not** claim Church revenue from bridge events alone

---

## What NOT to do

- Invent live checkout URLs without Stripe Dashboard links  
- Claim NFTs/on-chain mint without contracts  
- Redesign CUBE instead of selling diagnostic + seeker  
- Ignore production **503 suspended** — fix host before expecting public shop

---

## Next human actions

1. Restore dreamledger.org (service suspended)  
2. Today: market diagnostic as Church confession  
3. Stripe: create Member NZ$19 + Pack sim NZ$9 links  
4. Publish products into catalogue with silo tags `tcg_church`, `crypto_tcg`, `sanctum`  
5. Add three rails on shop.html when deploy is alive  
