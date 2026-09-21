# HANDOFF 2026-09-21 — Storefront surface cleaned (money path first)

**Priority:** Ball C (money exhaust) + public surface credibility.

## What was shipped this session

| Item | Path | Change |
|------|------|--------|
| Focused storefront | `public/index.html` | Replaced cluttered multi-rail surface with a tight commerce homepage. Primary CTAs are NZ$50 tile + NZ$29 diagnostic using **approved catalog** Payment Links. Honest NZ$0 meter chip. |
| Root mirror | `index.html` | Same focused surface so root and public stay aligned. |
| Commerce notes (earlier) | `ops/commerce/README.md` | Both offers explicit as settlement-eligible. |
| This handoff | `AGENT_BUS/HANDOFF-2026-09-21-SURFACE-CLEAN.md` | Evidence for operator. |

## Design decisions

- **Less is more.** Removed horizontal product rails, scarcity theatre, and secondary SKUs from the first fold.
- **Approved links only.** Tile: `https://buy.stripe.com/dRmbJ2cZi9eW4mk9La9oc02`. Diagnostic: `https://buy.stripe.com/8x28wQ0cwbn48CA3mM9oc00` (catalog entries).
- **Honest posture.** Chip states verified revenue NZ$0. No fake sales counts.
- **Same visual language.** Dark background, gold CTAs — cleaner layout, not a brand rewrite.

## Deploy note

If production is served from a host that still points at an older enterprise/black-gold template, a deploy or cache purge may be required for dreamledger.org to reflect `public/index.html`. The repo source of truth is now the focused surface.

## Current truth (unchanged)

- Verified external revenue: **NZ$0**
- Settlement primary: Founding Tile NZ$50
- Settlement secondary: CMD-DIAG-29 NZ$29

## Next concrete moves

1. Confirm production deploy serves the new `public/index.html` (or root index).
2. Human posts tile + diagnostic on owned channels.
3. Run Commerce Settlement Sync; keep meter honest at 0 until a real external `cs_`.
4. On first stranger pay: fulfil → fossil → update balls.

## Continuity

Do not re-inflate the homepage with every SKU. First sale remains the gate.
