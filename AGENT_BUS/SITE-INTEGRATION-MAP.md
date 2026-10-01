# Site integration map — join the dots (2026-10-01)

## Live (verified working)

| Path | Role |
|------|------|
| `/` | Front door |
| `/b2b` | **RIVET B2B hub** |
| `/marketplace` | Marketplace |
| `/mtg` | MTG ignition |
| `/billboard` | Billboard |
| `/api/offers` `/api/products` | Catalog (18 offers) |
| `/buy/{id}` | → Stripe live |
| `/.well-known/dreamledger.json` | Agent discovery |
| `/agent-commerce.json` | Agentic commerce contract |
| `/surfaces.json` | Surface registry |
| `/healthz` | Ops |

## In git, not yet on some routes

`/auctions.html` `/fees.html` `/trust.html` `/sell.html` `/sandbox-tools.html` — ensure deploy serves `public/` + extensionless aliases.

## Economic loop

discover → authorize (human) → pay (Stripe) → deliver → prove → ledger

## Trade Me slice

0% success fee positioning; earn on tools/diagnostics/kits; MTG-first specialist — not full classifieds parity yet.

## Operator

1. Deploy latest `public/`
2. Extensionless `/auctions` `/fees` `/trust` `/sell`
3. Sell $29 links
