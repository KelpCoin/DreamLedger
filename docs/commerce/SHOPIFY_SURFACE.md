# DreamLedger Commerce Surface

## Implemented
- Storefront shell
- Responsive catalog
- Product detail routes
- Checkout boundary
- Merchant economic-truth display
- Machine-readable checkout failure when payment is not configured
- Product taxonomy ready for expansion

## Target architecture
Merchant -> Catalog -> Product -> Checkout -> Payment Provider -> Order -> Fulfillment -> Evidence -> Reconciliation -> Customer receipt

## Next implementation layers
1. Real payment adapter using existing Stripe infrastructure.
2. Order persistence in Supabase.
3. Fulfillment state machine.
4. Customer receipt page.
5. Merchant dashboard.
6. Inventory and digital delivery.
7. Webhook reconciliation.
8. Public storefront domain and deployment.
9. MCP machine-commerce adapter.

No layer may create an order or revenue record without external payment evidence.