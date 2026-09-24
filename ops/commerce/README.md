# Commerce Settlement Spine

Stripe live payment evidence is the settlement authority. GitHub Actions reconciles.

## Live Payment Links (aligned 2026-09-25)

These match **production buy routers** (probed):

| Offer | NZD | Live plink |
|-------|-----|------------|
| Founding Tile | 50 | `https://buy.stripe.com/00w4gz6HzeWhcizeZedwc2w` |
| Commander Diagnostic | 29 | `https://buy.stripe.com/00wfZhaXP01neqHaIYdwc2R` |

Workflow: `.github/workflows/commerce-settlement-sync.yml`  
- Job **reconcile-tile** watches tile plink  
- Job **reconcile-diagnostic** watches diagnostic plink  

Requires secret `STRIPE_SECRET_KEY` and `STRIPE_LIVE_ENABLED=true` in the job env.

## Honest meter

Pre-sale: `verified_revenue_nzd: 0` (or empty matches).  
Post-sale: recognised only for paid live sessions on the configured plink.

See also: `ops/money/ZERO-BALANCE-PLAYBOOK.md`, `ops/money/SETTLEMENT-LINK-ALIGNMENT.md`.

Catalog `approved.json` should be updated by operator to match these plinks when convenient — **workflow follows live routers** so money is not invisible to the meter.
