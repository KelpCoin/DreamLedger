# Agentic settlement model — DreamLedger (2026-09-21)

## Research inputs (industry)

| Layer | Protocol / pattern | Role |
|-------|--------------------|------|
| Authorization | AP2 (Google → FIDO) | Prove a human authorized agent spend |
| Checkout | ACP (OpenAI + Stripe) | Agent-mediated merchant checkout |
| Machine pay | MPP (Stripe + Tempo), x402 (HTTP 402 + USDC) | Agent-to-merchant micropay / session pay |
| Escrow | x402B / Boson-style | Pay → deliver → release (not pure push) |
| Marketplace structure | Seaport / Reservoir / Blur | Off-chain orders, shared liquidity, low or zero platform fee |

Key lesson: **unbundle discovery, authorization, settlement, and fulfilment**. High take-rate monoliths (classic classifieds) are the opposite of agent-native design.

## DreamLedger mapping (honest)

| Stage | Live today | Not live yet |
|-------|------------|--------------|
| Discover | `/api/products`, `/api/offers`, `/agent-commerce.json` | On-chain orderbook |
| Authorize | Human Stripe Checkout handoff | Full AP2 credential flow |
| Pay | Stripe Payment Links (NZD) | x402 / MPP rails |
| Settle meter | Commerce Settlement Sync | Multi-rail reconciler |
| Fulfil | Per-SKU paths (billboard, diagnostic, kit, …) | Generic escrow |
| Prove | Fossil / evidence chain | Cross-protocol attestations |

**Fee stance:** DreamLedger listing fee = 0, success fee = 0 bps on current public offers. Processor fees remain Stripe’s domain.

## Agent purchase loop

1. `GET /agent-commerce.json` or `GET /api/offers`
2. Filter `checkout_available` / live primary offers
3. Return `checkout_url` to authorizing human (or future authorized agent wallet)
4. Stripe settles live `cs_`
5. Fulfilment + fossil — only then may verified external revenue move above 0

## Do not

- Count test mode, self-pay, or documentation as settlement
- Invent parallel carts that bypass catalog Payment Links
- Enable x402/MPP in production without meter + catalog support

## Surface files

- `public/agent-commerce.json` — contract
- `public/agent.json` — v2 agent interface
- `public/.well-known/dreamledger.json` — discovery v2
- Storefront `marketplace-v19` — fee + agent rails visible to humans
