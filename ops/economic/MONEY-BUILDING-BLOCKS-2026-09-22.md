# Money building blocks — 2026-09-22

**Goal:** Convert what already exists into cashflow instruments. Architecture without an external `cs_` is inventory, not income.

## What’s already real (use it)

| Block | Live surface | Monetisation mode |
|-------|----------------|-------------------|
| Horizontal market | https://dreamledger.org/ (`marketplace-v19`) | Human discovery + buy |
| Zero take-rate story | Fee strip on home + `/agent-commerce.json` | Differentiation vs high-fee classifieds |
| Stripe Payment Links | Catalog SKUs NZ$5–400 | Immediate checkout |
| Agent discovery | `/agent-commerce.json`, `/api/offers`, `/agent.json` | Agents recommend → human pays |
| Settlement meter | Commerce Settlement Sync | Only live external pays count |
| Bridge (partial) | Auth-gated `/api/agent-bridge` + GitHub/Supabase bus | Multi-device LLM continuity — not revenue by itself |

**Verified external revenue: still NZ$0.** That is correct until a stranger pays.

## 2026 trend fit (without cosplay)

Industry stack: **AP2** (auth) · **ACP** (agent checkout) · **MPP/x402** (machine pay) · open catalogs / low fees.

DreamLedger **today**: human (or agent-assisted) → Stripe Payment Link → settle → fulfil → fossil.  
**Reserved**: x402/MPP micropay rails. Do not block first sale on reserved rails.

## Building blocks that can make money *tomorrow*

### Block 1 — Primary SKU: Founding Billboard Tile · NZ$50
- Link: `https://buy.stripe.com/dRmbJ2cZi9eW4mk9La9oc02`
- Why it sells: permanent public placement, finite story, one-time payment, easy to explain in one sentence.
- Fulfilment: human review → publish tile.
- **Action:** pin this link on every owned channel with the one-liner in `ops/economic/SHARE-PACK-2026-09-22.md`.

### Block 2 — Fast secondary: Commander Diagnostic · NZ$29
- Link: `https://buy.stripe.com/00w7sLaXP01n96nbN2dwc2l`
- Why it sells: clear deliverable, MTG audience, lower ticket = easier first stranger.
- Fulfilment: existing diagnostic path after settle.
- **Action:** post in MTG groups / Discord with “pay → get structure/cuts/upgrades” framing. No hype inventory.

### Block 3 — Digital product: Discord Webhook Starter · NZ$79
- Link: `https://buy.stripe.com/4gMcN56HzaG1dmDeZedwc1n`
- Why it sells: operator tooling; buyers already in Stripe/Discord world.
- **Action:** sell to builders, not gamers.

### Block 4 — Agentic referral surface (B2B wedge, not cash yet)
- Agents read `/api/offers` and hand humans `checkout_url`.
- **Action:** when talking to other operators/agents, point at `/agent-commerce.json` as the contract. Revenue still only from Stripe.

### Block 5 — Evidence trust (defensive asset)
- Fail-closed meter, fossils, no fake sales counts.
- **Why it matters for money:** buyers and partners in 2026 discount claims; evidence chains reduce refund/chargeback narrative risk and support later wholesale/agent deals.

## What does *not* make money this week

- Expanding Phin Haven / Floor 2 before first external settle  
- Building x402 before a stranger has paid NZ$29 or NZ$50  
- Re-skinning the storefront again instead of posting links  
- Counting bridge 401s, CI greens, or self-tests as revenue  

## 72-hour operator sequence

1. **Hour 0:** Confirm live site shows fee strip + tile/diagnostic CTAs (hard refresh).  
2. **Hour 0–2:** Post **tile** and **diagnostic** using share pack (3 channels minimum).  
3. **Day 1:** Run Commerce Settlement Sync once; leave meter at 0 if no `cs_`.  
4. **On first stranger pay:** fulfil same day → fossil → bump `PING_PONG_BALLS` + figure-eight status.  
5. **Only after first settle:** consider second channel experiments or x402 R&D.

## Success metric

One field only: **`verified_external_revenue_nzd` > 0** with a live external Checkout Session + fulfilment proof.
