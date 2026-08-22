# CUBE Silo Registry v1

This registry is the canonical boundary for all commerce verticals. Every silo gets its own catalog namespace, inventory rules, fulfillment contract, pricing, public surface, and data filters while sharing the B2B Commerce Spine.

## Active silos

| Silo ID | Public route | Purpose | Isolation rule |
| --- | --- | --- | --- |
| mtg | /mtg | Magic: The Gathering inventory and decks | Never ingest DreamMeez/adult material |
| dreammeez | /dreammeez | Avatar identity, cosmetics, streak economy | Cross-game item IDs allowed; no adult material |
| media-music | /media-music | Music, media, vinyl, digital media and creator inventory | No MTG inventory mutation |
| digital-products | /digital-products | Templates, reports, code, data packs and downloadable goods | Delivery must be digital and auditable |
| nz-secondhand | /nz-secondhand | New Zealand secondhand clothing and accessories | Seller geography NZ; condition required |
| b2b | /marketplace | Cross-silo wholesale/procurement marketplace | Aggregates approved products; never bypasses source-silo rules |

## CUBE rules

1. Catalog: every product belongs to exactly one source silo.
2. Unique identity: every product has a globally unique SKU and item_id where applicable.
3. Commerce: checkout is server-authoritative and refers to a source-silo product record.
4. User state: streaks, rewards, referrals and ownership are user-level but reward eligibility is policy-driven.
5. Evidence: payment, fulfillment, payout and state-change evidence must be recorded.
6. Boundary: no silo may import forbidden content from another silo merely because it exists in the shared catalog.
7. Marketplace: the B2B layer is a view/orchestration layer over source-silo offers, not a second source of truth.
8. Approval: public acquisition and irreversible external publication remain approval-gated.

## Shared product envelope

```json
{
  "sku": "STRING",
  "item_id": "STRING",
  "silo": "ENUM",
  "title": "STRING",
  "description": "STRING",
  "price_nzd": 0,
  "currency": "NZD",
  "status": "draft|published|quarantined|sold_out",
  "inventory": 0,
  "fulfillment_type": "physical|digital|service",
  "seller_id": "STRING",
  "metadata": {},
  "cross_game": false
}
```

## B2B marketplace boundary

The marketplace presents eligible source-silo offers to business buyers. It requires seller onboarding, inventory ownership, order routing, commission accounting, payout state, disputes and evidence. Stripe Connect is the intended future settlement rail; no seller payout is activated merely by listing an item.
