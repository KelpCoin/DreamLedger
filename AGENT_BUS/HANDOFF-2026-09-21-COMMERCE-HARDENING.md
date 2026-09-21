# HANDOFF 2026-09-21 — Commerce settlement notes hardened (both offers)

**Priority:** Ball C (money exhaust). Meter remains honest at NZ$0.

## What was shipped this session

| Item | Path | Change |
|------|------|--------|
| Commerce settlement spine | `ops/commerce/README.md` | Explicitly documents both NZ$50 Founding Tile and NZ$29 Commander Diagnostic as approved / settlement-eligible. Primary workflow target remains the tile. Notes catalog-vs-public-link discipline. |
| This handoff | `AGENT_BUS/HANDOFF-2026-09-21-COMMERCE-HARDENING.md` | Durable evidence for the operator and next agent. |

## Why this matters

Previous commerce README only highlighted one offer. The approved catalog already contained both. Public distribution links and storefront links have diverged in places. The update makes the dual-offer acceptance explicit so a paid session on either approved link can be recognized once the workflow is pointed at it, without inventing revenue or weakening fail-closed rules.

## Current truth (unchanged)

- Verified external revenue: **NZ$0**
- Settlement authority: live Stripe only
- Primary configured link in workflow: Founding Tile (`https://buy.stripe.com/dRmbJ2cZi9eW4mk9La9oc02`)
- Secondary approved offer: CMD-DIAG-29

## Next concrete moves (pick one, finish, handoff)

1. **Human / owned channels:** Post tile + diagnostic using the distribution starter pack. Demand is the remaining bottleneck.
2. **GitHub + secrets:** Run **Commerce Settlement Sync** (`workflow_dispatch`). Confirm artifact still shows `verified_revenue_nzd: 0` or records a real external `cs_`.
3. **Catalog alignment (if needed):** If a public/storefront Payment Link differs from the approved catalog entry, either update the catalog (with live Stripe verification) or point distribution at the catalog URL. Do not accept uncatalogued links as settled.
4. **On first stranger pay:** Fulfil → fossil → update `PING_PONG_BALLS.json` and figure-eight status > 0.

## Blockers this session cannot clear

- No live Stripe secret in this agent context → cannot list live sessions or rotate Payment Links.
- Cannot manufacture external demand.
- Public link / catalog divergence may still exist; resolve only with live Stripe evidence.

## Continuity

Read `AGENT_BUS/PING_PONG_BALLS.json` and `ops/commerce/README.md` before inventing a parallel money path. Write the next `AGENT_BUS/HANDOFF-*.md` when state changes.
