# HANDOFF 2026-09-21 — Marketplace storefront v16

**Priority:** Public surface credibility + Ball C (money).

## Problem

Production (Render) was still serving enterprise-v1 clutter. Operator feedback: site looks unusable vs Shopify/TradeMe. Previous focused page had not deployed to live yet (live commit lag).

## What was shipped

| Path | Change |
|------|--------|
| `public/index.html` | Full marketplace-grade surface (v16): hero + featured tile, category filters, product grid, how-it-works, sticky mobile CTAs, honest NZ$0 meter. |
| `index.html` (root) | Minimal redirect/pointer so root does not fight public. |
| This handoff | Evidence. |

## Design intent (Shopify / TradeMe class)

- **Grid marketplace**, not a long vertical essay or swipe-rail gimmick.
- **Category filters** (All / Placement / Magic / Digital / Identity / Play).
- **Featured primary offers** with one-click Stripe.
- **Trust bar** + explicit verified revenue NZ$0.
- **Mobile sticky** dual CTA (tile + diagnostic).
- Checkout URLs from `public/catalog.json` published products.

## Deploy

Live is Render (`x-render-origin-server`). Auto-deploy on `main` should pick up this commit. If not, trigger a manual Render deploy of the DreamLedger service.

Verify after deploy:

```
curl -s https://dreamledger.org/version
# expect newer commit SHA
curl -s https://dreamledger.org/ | head -c 200
# expect data-surface="marketplace-v16"
```

## Meter

Verified external revenue remains **NZ$0** until real external settlement.

## Next

1. Confirm Render served v16.
2. Human demand pulse on owned channels.
3. Settlement sync on first stranger pay.
