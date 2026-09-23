# B2B marketplace APIs — applied to DreamLedger

## Industry patterns used

| Pattern | Industry source shape | DreamLedger apply |
|---------|----------------------|-------------------|
| Catalog read API | Salesforce / Adobe shared catalog, Shopify Catalog | `GET /api/offers`, `/api/products` |
| Stable product schema | OpenAPI components | `public/b2b/catalog.openapi.json` |
| Checkout handoff URL | UCP / agent checkout | `/buy/{slug}` → Stripe Payment Link |
| Fee transparency | Marketplace vs direct | 0 bps platform success on listed public offers |
| No parallel cart | Avoid dual ledgers | Agents must not invent a second cart |

## Do not copy blindly

- RapidAPI-style 25% marketplace cut — **not** our public offer model  
- Shared B2B tier prices (Adobe) — later; fixed NZD catalog first  
- Claiming UCP/x402 live — **not** until catalog + meter support  

## Partner loop

1. Read OpenAPI + `/api/offers`  
2. Present `checkout_url` to human or authorized path  
3. Stripe settles  
4. Fulfilment (billboard path or Performance Wall digital)  
5. Evidence on settlement spine — revenue only after external proof  
