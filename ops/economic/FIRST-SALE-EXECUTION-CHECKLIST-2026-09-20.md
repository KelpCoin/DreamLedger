# First-sale execution checklist — 2026-09-20

**Goal:** One **external** live Stripe payment → settlement recognized → fulfilment evidence → fossil → meter > 0.  
**Not the goal:** More architecture without a buyer.

## 0. Truth rules (do not skip)

- [ ] Test mode / self-pay / refund loops **do not** count as verified external revenue  
- [ ] Need: live mode + external customer + paid + attribution + fulfilment note + proof artifact  
- [ ] Game play / Shallows clear **never** substitutes for payment  

## 1. Inlet pressurized (Turbine B)

- [ ] Open https://dreamledger.org/?src=dist — storefront loads  
- [ ] Open tile Payment Link: https://buy.stripe.com/9B66oH2rj3dz82jcR6dwc2x  
- [ ] Open diagnostic Payment Link: https://buy.stripe.com/00w7sLaXP01n96nbN2dwc2l  
- [ ] Confirm Stripe Dashboard: links are **live** mode, NZD, correct amounts (50 / 29)  
- [ ] Confirm fulfilment path known (tile: publish placement; diagnostic: templated write-up ≤20 min)  

## 2. Meter ready (generator)

- [ ] GitHub env `settlement-read` has `STRIPE_SECRET_KEY`, payment link URL(s), Airtable token if used  
- [ ] `STRIPE_LIVE_ENABLED=true`  
- [ ] Run Actions: **Commerce Settlement Sync** (workflow_dispatch)  
- [ ] Artifact shows pre-sale: `verified_revenue_nzd: 0` OR already shows a real `cs_` (then jump to §4)  

If multiple Payment Links (29 vs 50), reconciliation must accept **both** amounts or run parallel rules — do not drop NZ$50 silently if workflow was written only for NZ$29 (see `ops/commerce/README.md`; extend if needed).

## 3. Demand pulse (ocean gates — owned channels only)

Use `ops/distribution/DISTRIBUTION_STARTER_PACK_2026-09-17.md`:

- [ ] Pin Discord / own community: tile NZ$50 + diagnostic NZ$29 + store URL  
- [ ] One helpful Reddit reply only where allowed (diagnostic framing vs free auto-tools)  
- [ ] One short X/post with tile link if channel is owned/active  
- [ ] QR only after scannable PNG exists — target `?src=qr-canonical`  
- [ ] **Do not** mass-spam cold subs  

## 4. When a stranger pays

- [ ] Stripe shows live `checkout.session.completed` / `payment_intent.succeeded`  
- [ ] Settlement sync recognizes event (or manual insert per evidence contract)  
- [ ] Fulfil within promised window; store delivery proof (hash, URL, ticket id)  
- [ ] Package fossil (bridge `fossils` table or `proof/commerce/` JSON)  
- [ ] Mark offer VALIDATED if that is the operational status model  
- [ ] Update `AGENT_BUS/PING_PONG_BALLS.json` → `verified_external_revenue_nzd`  
- [ ] Update bridge `docs/figure-eight-status.json` same number  
- [ ] Write `AGENT_BUS/HANDOFF-YYYY-MM-DD-FIRST-SALE.md`  

## 5. Bridge alignment

- [ ] Economic event row: `is_test_mode=false`, `is_external_customer=true`, `status=succeeded`  
- [ ] `amount_cents` matches 2900 or 5000 (or 7900 for kit)  
- [ ] Raw Stripe payload retained for audit  
- [ ] Oracle verdict PASS only if chain complete  

## 6. Stop conditions

- Stop inventing new SKUs before first validated sale  
- Stop Floor 2 game scope as a substitute for §3–4  
- Stop claiming revenue from workflow green alone  

## 7. Minimum viable week

| Day focus | Action |
|-----------|--------|
| 1 | §1 + §2 green (meter honest at 0) |
| 2–3 | §3 owned-channel pulses |
| Any | On payment → §4 same day |

**Success:** one PASS fossil, not ten new design docs.
