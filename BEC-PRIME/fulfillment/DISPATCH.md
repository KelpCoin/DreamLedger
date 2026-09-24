# Fulfilment dispatch

After **live paid** session (not before).

| Product / loop | Handler | Auto? |
|----------------|---------|-------|
| Founding tile | Billboard placement + human review | Semi |
| Commander diagnostic | Report template + optional Performance Wall key | Target auto |
| Discord webhook kit | Digital download after paid session | Auto path preferred |
| Cosmetics | Email-match entitlement | Semi |
| Performance Wall SKUs | `performance_wall.py` mint → claim → TTL | Target auto |

## Dispatcher contract

1. Verify Stripe event / session (signature + idempotency) — see webhook security applied docs  
2. Map `product_id` / SKU → row in `PRODUCT-FULFILLMENT-REGISTRY.json`  
3. Execute handler  
4. Record delivery evidence  
5. Run `scripts/fossil_checklist.py` mindset / seal fossil  

## Air-gap

Draft reports offline; **release only after** live pay confirmation synced via bridge or Stripe dashboard.

## Missing production wiring

- End-to-end webhook → wall mint on Render must be proven once  
- Multi-offer Settlement Sync recognition  
