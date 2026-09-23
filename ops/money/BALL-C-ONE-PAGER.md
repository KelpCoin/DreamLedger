# Ball C — one pager (do this, not architecture)

**Status:** OPEN — verified external revenue **NZ$0**

## Sell now

| What | URL |
|------|-----|
| Store | https://dreamledger.org/?src=dist |
| Founding tile NZ$50 | https://buy.stripe.com/dRmbJ2cZi9eW4mk9La9oc02 |
| Diagnostic NZ$29 (catalog) | https://buy.stripe.com/8x28wQ0cwbn48CA3mM9oc00 |

Settlement primary target = **tile** (`ops/commerce/README.md`). Catalog is authority; public links must match approved plinks to settle.

## Operator checklist (human)

- [ ] `settlement-read` env has live `STRIPE_SECRET_KEY`  
- [ ] Commerce Settlement Sync runs; pre-sale proof shows `verified_revenue_nzd: 0`  
- [ ] Webhook / fulfil path ready for chosen SKU  
- [ ] **Post tile link once** on an owned authorized channel  
- [ ] On stranger pay: Settlement Sync → fulfil → fossil → only then claim >0  

## Agents must not

- Expand play/AI design ahead of this checklist  
- Claim sale without `cs_` + fossil  
- Invent demand  

## Scripts

`ops/money/INCOME-NOW.md` · `Run-FirstSaleThread.ps1`
