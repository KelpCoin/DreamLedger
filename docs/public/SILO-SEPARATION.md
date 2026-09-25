# Public silo separation (default)

## Rule

Each **silo** is a separate horizontal rail on the public home page.

| Silo id | Public name | Contains | May sell? |
|---------|-------------|----------|-----------|
| `market` | Market | Paid products only | Yes — Stripe |
| `identity` | Identity | Account, login, avatar | No (free) |
| `play` | Worlds | Phin Haven, billboard view | No (entry free) |

## Defaults

- **No cross-silo cart** by default.
- **No shared “buy everything”** CTA.
- Wiring later (e.g. cosmetics after play) is explicit product work — not implied by the home page.

## Markup

```html
<section class="silo" data-silo="market">…</section>
```

Agents and future compilers must not merge rails without an approved cross-silo product.

## CTA cards

One card = one action (Buy / Sign up / Play). No multi-action cards.
