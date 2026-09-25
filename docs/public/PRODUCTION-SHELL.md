# Production shell (prod-v5)

## This increment

- Sticky header, trust strip, silo horizontal carousels
- CTA card per product / action
- Footer with shop + support
- Matching login / register
- Inline CSS (no broken external sheet)
- No floating QR, no internal ops language

## Silo isolation

| data-silo | Contents |
|-----------|----------|
| market | Paid Stripe products only |
| identity | Account / avatar |
| play | Phin Haven / billboard view |

## Not yet enterprise-complete

- Shared skin on every legacy route (`/billboard` pages still independent)
- Real product photography
- Order history UI
- Full a11y audit

Next increments: skin sub-routes, product media, account orders.
