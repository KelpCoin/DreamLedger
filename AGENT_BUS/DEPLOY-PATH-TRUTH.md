# Deploy path truth (2026-10-02)

## Why `public/*` can sit on GitHub but 404 on dreamledger.org

Commercial CD (`.github/workflows/commercial-cd.yml`) path filters include:

- `BEC-PRIME/compiled/website/**`
- `BEC-PRIME/**`
- NOT a blanket `public/**`

Render production deploy is **approval-gated**: workflow_dispatch `deploy=true` → `release-operator.yml` with `deploy=confirm` under `environment: production`.

## What is live without waiting for HTML deploy
- `/buy/{product_id}` → Stripe (API/router)
- `/mtg` `/` `/b2b` `/healthz` `/api/offers`

## What we mirrored into compiled website (this commit)
- `BEC-PRIME/compiled/website/start.html`
- `BEC-PRIME/compiled/website/money.html`
- `BEC-PRIME/compiled/website/assets/silo-master.css`
- `BEC-PRIME/compiled/website/seller-audit-input.html`

Keep copies in `public/` for agents; **compiled website is closer to the CD spine**.

## Operator: actually ship
1. GitHub → Actions → Commercial CD Gate → Run workflow → deploy **true** (needs production env approval)
2. Or Render dashboard manual deploy of latest main
3. Verify:
```
curl -sS -o /dev/null -w "%{http_code}" https://dreamledger.org/start
curl -sS -o /dev/null -w "%{http_code}" https://dreamledger.org/assets/silo-master.css
```

## Revenue while waiting
Outbound Stripe links only. Fulfillment templates in AGENT_BUS/FULFILLMENT/.
