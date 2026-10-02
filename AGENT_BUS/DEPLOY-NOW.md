# DEPLOY NOW — blocks economic surfaces

**Probed 2026-10-02:** `/healthz` 200 · `/start` 404 · `/assets/silo-master.css` 404

## Ship these from `public/` to live (extensionless preferred)

| File | Live path | Why |
|------|-----------|-----|
| `start.html` | `/start` | Conversion funnel |
| `money.html` | `/money` | Offer list |
| `assets/silo-master.css` | `/assets/silo-master.css` | Master silo look |
| `diagnostic-input.html` | already often live | Post-pay MTG |
| `seller-audit-input.html` | `/seller-audit-input.html` | Post-pay audit |
| `thanks-diagnostic.html` | `/thanks-diagnostic.html` | Upsell after fulfill |
| `mtg-list.html` `mtg-search.html` `mtg-mod.html` | `/mtg-list` etc | Liquidity UX |
| `retro.html` `vinyl.html` `boardgames.html` | `/retro` … | Cube clones |

## Money paths already live (do not wait)
- `/buy/COMMANDER-DECK-DIAGNOSTIC-001`
- `/buy/SELLER-PROFIT-AUDIT-001`
- `/buy/DOC-EXTRACT-50` and other `/buy/{id}`

## CI check after deploy
```
curl -sS https://dreamledger.org/healthz
curl -sS -o /dev/null -w "%{http_code}" https://dreamledger.org/start
curl -sS -o /dev/null -w "%{http_code}" https://dreamledger.org/assets/silo-master.css
```
