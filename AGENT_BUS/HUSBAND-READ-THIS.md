# Husband — zero balance

**Verified external revenue: NZ$0.** Only a live customer payment changes that.

## Critical fix just made

Settlement Sync was watching an **old** Stripe link. Live checkout used a **different** link — so a real sale might not have shown on the meter.  
**Fixed:** workflow now watches the **live** tile + diagnostic Payment Links.

## Do this next

1. Open [`ops/money/COPY-PASTE-NOW.txt`](../ops/money/COPY-PASTE-NOW.txt) — post it  
2. Open [`ops/money/ZERO-BALANCE-PLAYBOOK.md`](../ops/money/ZERO-BALANCE-PLAYBOOK.md)  
3. GitHub Actions → **Commerce Settlement Sync** → Run (needs `STRIPE_SECRET_KEY`)  

## Sell URLs

- Tile: https://dreamledger.org/buy/DREAMLEDGER-BILLBOARD-FOUNDING-001  
- Diagnostic: https://dreamledger.org/buy/COMMANDER-DECK-DIAGNOSTIC-001  
