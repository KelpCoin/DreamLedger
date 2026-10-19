# DreamMeez Cash Register 001 — First Light

**Priority:** DreamMeez cosmetics over billboards and MTG.

**Goal:** One independent buyer successfully purchases a DreamMeez cosmetic and receives a durable entitlement in their inventory.

## Locked collection
See `collection-001-first-light.json` for exact SKUs, prices, and sets.

## Minimum entitlement path
1. Stripe webhook (signed, server-side verification only)
2. Map price/product → SKU(s)
3. Upsert into `owned_objects` (user_id, sku, source_payment_id, granted_at)
4. Unique constraint on (user_id, sku) for idempotency
5. Inventory UI shows Owned + Equip
6. Equipped state persists and is visible in PhinHaven when ready

## Acceptance
- [ ] Stripe products live for all SKUs + 3 sets
- [ ] Webhook → entitlement write works
- [ ] Non-owner test purchase succeeds
- [ ] Item appears in inventory and can be equipped
- [ ] No double-grant on replay
- [ ] First external (non-owner) payment recorded as verified revenue only after settlement

## Do not
- Count self-payments as external revenue
- Sell gameplay power
- Expand catalogue before the first real external sale lands

## Next after first sale
Soft-launch the shop page, then expand collections only if demand appears.
