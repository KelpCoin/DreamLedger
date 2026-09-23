# Settlement link alignment

**Problem:** A buyer can pay on Stripe while Settlement Sync watches a **different** Payment Link. Money hits the bank; the **system meter** stays 0.

**Ambition:** One canonical plink per live SKU everywhere: Stripe, `/buy` router, catalog, billboard page, Settlement Sync env.

---

## Checklist (operator)

### Tile NZ$50

- [ ] Stripe Dashboard → Payment Links → open the **live** tile product  
- [ ] Copy exact `https://buy.stripe.com/...` URL  
- [ ] `BEC-PRIME/catalog/offers/approved.json` → `payment_link_url` matches  
- [ ] Hitting `https://dreamledger.org/buy/DREAMLEDGER-BILLBOARD-FOUNDING-001` lands on **that same** URL  
- [ ] Billboard page CTAs use **that same** URL (not a third plink)  
- [ ] GitHub Action / `settlement-read`: `STRIPE_PAYMENT_LINK_URL` (or workflow input) matches **that same** URL  
- [ ] Private window test: open buy router → confirm Stripe page title/price NZ$50  

### Diagnostic NZ$29

- [ ] Same steps for diagnostic plink  
- [ ] `/buy/COMMANDER-DECK-DIAGNOSTIC-001` matches approved catalog  
- [ ] Optional second Settlement Sync job or rotated URL for diagnostic recognition  

### Pre-sale proof

- [ ] Run **Commerce Settlement Sync**  
- [ ] Artifact shows `verified_revenue_nzd: 0` (or equivalent) with **no** false positives  

### Record (fill in)

| SKU | Canonical plink | Date aligned | Initials |
|-----|-----------------|--------------|----------|
| Tile NZ$50 | | | |
| Diag NZ$29 | | | |

---

## Observed drift (historical — re-check live)

As of 2026-09-24 verification:

| Source | Example plink host path |
|--------|-------------------------|
| Catalog docs | `dRmbJ2cZi9eW4mk9La9oc02` (tile) |
| Live `/buy` tile | different `buy.stripe.com/...` |
| Billboard page | yet another `buy.stripe.com/...` |

Treat the table as a **warning**, not permanent truth — re-verify after each Stripe edit.

---

## Done when

One URL string for tile appears in catalog + buy router + primary marketing + settlement config.
