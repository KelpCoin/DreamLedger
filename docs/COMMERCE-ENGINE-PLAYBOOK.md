# DreamLedger commerce engine playbook

Synthesised for a solo operator: one working offer, modular rails, no theatre.

## Principles (what actually scales early)

1. **One hero product until cash is proven** — Commander diagnostic NZ$29.
2. **Price on the card is the price** — NZD, Stripe, no hidden steps.
3. **Attribution on every buy** — always `/buy/{product_id}` not raw Payment Link in marketing UI.
4. **Paid is not delivered** — diagnostic needs decklist input after Stripe.
5. **One design system** — light shell in `/shop.css`; new pages link it.
6. **Catalogue is data** — `/api/products` + `/api/offers`; UI is a view.
7. **Dead links are defects** — policies, about, shop must return 200.

## Modular rails (reuse these)

| Rail | Path |
|------|------|
| Design system | `/shop.css` |
| Homepage | `/` (`public/index.html`) |
| Full shop (API-driven) | `/shop.html` |
| Buy router | `/buy/{product_id}` |
| Policies | `/policies.html` |
| About | `/about.html` |
| Post-pay diagnostic | `/diagnostic-input.html` |
| Agent contract | `/agent-commerce.json` |
| Offers API | `/api/offers` |

## Add a new product (repeatable)

1. Publish product with Stripe Payment Link in the product API / catalog JSON.
2. Ensure `/buy/{id}` redirects with `client_reference_id`.
3. Optional: `public/buy/{slug}/index.html` via `scripts/sync-public-buy-pages.mjs`.
4. Shop grid picks it up automatically from `/api/products`.
5. Optionally feature it on the homepage hero (manual).

## Operator checklist (this week)

- [ ] Stripe Payment Link success URL for diagnostic → `https://dreamledger.org/diagnostic-input.html?session_id={CHECKOUT_SESSION_ID}`
- [ ] Confirm deploy of latest `public/` to production
- [ ] Complete one real external purchase end-to-end
- [ ] Fix or retire Supabase `marketplace-diagnostic-delivery` if still 500
- [ ] Share one link only: `/buy/COMMANDER-DECK-DIAGNOSTIC-001`

## What not to do yet

- Rebuild as Trade Me clone before first verified revenue
- New silos without a buy button and delivery path
- Operator jargon (“margin”, “cube cells”) on customer pages
