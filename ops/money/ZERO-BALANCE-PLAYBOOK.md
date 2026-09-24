# Zero balance playbook

**Situation:** Bank / verified external revenue is **NZ$0**.  
**Response:** Do not build more silos. Close one paid loop.

---

## Why money could land and still look like zero

| Failure | Fix |
|---------|-----|
| Nobody posted a link | `DEMAND-KIT.md` — post today |
| Posted wrong / dead link | Use **site buy routers** only |
| Paid but Settlement Sync watched **stale plink** | Fixed in workflow 2026-09-25 to live destinations |
| No `STRIPE_SECRET_KEY` in Actions | Add repo/org secret |
| Self-pay counted as hope | Do not count as BusinessTruth |

### Live destinations (probed)

| Offer | Router | Stripe destination |
|-------|--------|--------------------|
| Tile NZ$50 | https://dreamledger.org/buy/DREAMLEDGER-BILLBOARD-FOUNDING-001 | `https://buy.stripe.com/00w4gz6HzeWhcizeZedwc2w` |
| Diagnostic NZ$29 | https://dreamledger.org/buy/COMMANDER-DECK-DIAGNOSTIC-001 | `https://buy.stripe.com/00wfZhaXP01neqHaIYdwc2R` |

Settlement Sync jobs now watch **these** plinks (not the old `9B66oH…` only).

---

## Next 90 minutes (operator)

1. Confirm GitHub secret `STRIPE_SECRET_KEY` exists (live).  
2. Actions → **Commerce Settlement Sync** → Run (expect 0 sessions).  
3. Send **one** post (copy below).  
4. Send **three** warm DMs.  
5. Stop coding until a pay or end of day.

### Single post (copy)

> Permanent 100×100 spot on DreamLedger’s public internet billboard — NZ$50. Title + link at checkout. Stripe. No DreamLedger success fee on this listing.  
> https://dreamledger.org/buy/DREAMLEDGER-BILLBOARD-FOUNDING-001

### MTG alternate

> Commander deck diagnostic — NZ$29 — structure, cuts, upgrades.  
> https://dreamledger.org/buy/COMMANDER-DECK-DIAGNOSTIC-001

---

## After first pay

`POST-SALE-PROTOCOL.md` same day. Fulfil before celebrating.

## What agents must not do

- Announce revenue  
- Add 500 SKUs  
- Redesign the site instead of demanding distribution  
