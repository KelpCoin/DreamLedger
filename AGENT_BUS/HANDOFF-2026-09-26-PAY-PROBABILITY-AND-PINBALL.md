# HANDOFF 2026-09-26 — PAY PROBABILITY + LLM PINBALL

**From:** Grok session (operator asked: increase chance of getting paid; close/tighten loops; fill silos; leave pinball for next LLM)  
**Vision context (operator):** B2B marketplace + agentic commerce + trust/validation layer; programmatic DOOH / million-pixel billboards; game + avatar ecosystem; MTG EDH diagnostic; liquidate MTG collection + music/media; white-label sandbox aimed at replacing Trade Me → Shopify-class.  
**Truth:** `verified_external_revenue_nzd = 0`. Do not claim otherwise.

---

## WHAT THIS AGENT IS DOING TO INCREASE PAY PROBABILITY

1. **Sell what is already live** (highest EV). Three money silos exist with buy routers.
2. **Tighten fulfilment** so a pay can close same day (AUTO-FULFIL-SKUS already maps auto vs human review).
3. **Force distribution** into the critical path — the only missing step is human-owned posts/DMs.
4. **Candidate loops only** for million-dollar vision (MTG liquidation, B2B trust, DOOH, white-label) — **gated** until ≥1 external fossil (NS6 / PROFIT-RULES).
5. **Supabase fill brief** for any agent with DB access (this session has none).
6. **Pinball** — outbox ping + balls bump + explicit next-agent commands so the next LLM does not invent architecture.

---

## CLOSED / LIVE LOOPS (MONETIZE OR TIGHTEN)

| Loop | Price | Status | Tighten action |
|------|-------|--------|----------------|
| LOOP-BILLBOARD-FOUNDING-50 | NZ$50 | live_offer | Human post + warm DMs; tile fulfil = allocate→review→publish <72h |
| LOOP-CMD-DIAG-29 | NZ$29 | live_offer | Prefer auto report path; seal-breaker SKU |
| LOOP-DISCORD-WEBHOOK-79 | NZ$79 | live_offer | Highest margin; lead posts with kit after first any-pay |
| LOOP-AGENT-BRIDGE-COORD | — | infrastructure | Not sold; coordinates only |
| LOOP-CLOUD-SENTINELS | — | infrastructure | Probe only |
| LOOP-TRUTH-ORACLE | — | attention funnel | CTA only into live offers |
| LOOP-PHIN-COSMETICS | micro | live_micro | After email entitlement path proven |
| DOOH_CUBE_001 | NZ$50 def | DEFINED not live | Human approval for first live booking; do not sell as proven |

**Primary weapons this week (do not dilute):** tile $50, diagnostic $29, kit $79.  
**Buy routers (prefer over raw plinks):**  
- https://dreamledger.org/buy/DREAMLEDGER-BILLBOARD-FOUNDING-001  
- https://dreamledger.org/buy/COMMANDER-DECK-DIAGNOSTIC-001  
- https://dreamledger.org/buy/DISCORD-WEBHOOK-STARTER-KIT-001  

**Known risk:** SHARE-PACK and older handoffs sometimes show different Stripe plink IDs than FIRST-SALE-READINESS / registry. **Next agent with Stripe access: align one canonical plink per SKU** (`ops/money/SETTLEMENT-LINK-ALIGNMENT.md`) or meter stays blind after a real pay.

---

## OPERATOR COPY-PASTE (DO THIS — THIS IS THE MONEY)

### Post 1 — margin (kit)
```
Discord webhook starter kit — NZ$79
Payment alert templates. Pay with Stripe, download after checkout.
https://dreamledger.org/buy/DISCORD-WEBHOOK-STARTER-KIT-001
```

### Post 2 — seal breaker (diagnostic)
```
Commander deck diagnostic — NZ$29
Structure, cuts, upgrade priorities. Report after payment.
https://dreamledger.org/buy/COMMANDER-DECK-DIAGNOSTIC-001
```

### Post 3 — placement (tile)
```
Founding billboard tile — NZ$50
Permanent 100×100 on the public board. Title + link at checkout.
https://dreamledger.org/buy/DREAMLEDGER-BILLBOARD-FOUNDING-001
```

### Warm DM
```
Hey — billboard tiles are live at NZ$50 if you ever wanted a permanent square on the public board:
https://dreamledger.org/buy/DREAMLEDGER-BILLBOARD-FOUNDING-001
No pressure. Or Commander diagnostic NZ$29:
https://dreamledger.org/buy/COMMANDER-DECK-DIAGNOSTIC-001
```

**Minimum for pay probability:** 3 owned-channel posts + 5 warm DMs + confirm STRIPE_SECRET_KEY + one Settlement Sync run.  
**Then stop coding until pay or EOD.**

---

## CANDIDATE ROUTES (VISION → FUTURE LOOPS — NOT SOLD YET)

Do **not** create Stripe products or public CTAs for these until ≥1 external fossil OR human explicitly overrides NS6.

| Candidate loop_id | Maps to vision | First money shape | Gate |
|-------------------|----------------|-------------------|------|
| LOOP-MTG-LIQUIDATION-LOT | Liquidate collection | Curated lot listing NZ$ / market-clear | After first fossil; inventory CSV + photos |
| LOOP-MTG-EDH-RETAINER | EDH diagnostic upsell | NZ$99 multi-list / season pack | After ≥3 diagnostic pays |
| LOOP-B2B-TRUST-ATTEST | Trust + validation layer | NZ$199 one-time attestation pack for a merchant surface | After Economic Court first gate |
| LOOP-AGENTIC-COMMERCE-RAIL | Agentic commerce | Take-rate 0% on listed; charge settlement/attestation fee later | agent-commerce.json already public |
| LOOP-DOOH-PROGRAMMATIC | Programmatic DOOH | DOOH_CUBE_001 NZ$50 flight + Ed25519 proof | First live booking needs human approval |
| LOOP-MILLION-PIXEL-BOARD | Million-pixel inspired | Scale tile grid beyond founding 100×100 | After tile fossil + inventory rules |
| LOOP-AVATAR-COSMETIC-B2C | Game + avatar ecosystem | DreamMeez entitlement micro | Email↔Stripe match proven |
| LOOP-WHITELABEL-SANDBOX | Replace Trade Me / Shopify path | Founder white-label sandbox fee | After 20 verified paid events (NS6) |
| LOOP-MUSIC-MEDIA-LOT | Music/media liquidation | Digital lot / license | Inventory first |

Full machine-readable seeds: `AGENT_BUS/ECONOMIC-LOOPS/candidates-2026-09-26.json` on this branch.

---

## SUPABASE FILL BRIEF (FOR LLM WITH DB ACCESS)

Copy-paste to any agent that has Supabase service role / SQL editor.

```
TASK: Fill / sync true money silos + evidence tables. Do NOT invent revenue.

1. Read ops/silos/true_silos_registry.json (6 true silos). Upsert public-safe rows only.
2. Ensure tables exist for: economic_events, fossils, oracle_verdicts (see KelpCoin/llm-supabase-github-bridge migrations / DreamLedger supabase/migrations).
3. Insert prospecting rows ONLY with approval_status = pending_human_review. Never set approved without human.
4. Seed offer refs:
   - OFFER-DREAMLEDGER-BILLBOARD-FOUNDING-001 / NZ$50
   - OFFER-CMD-DIAG-29-NZD / NZ$29
   - DISCORD-WEBHOOK-STARTER-KIT-001 / NZ$79
5. verified_external_revenue_nzd stays 0 until livemode Stripe session + attribution + fulfilment + independent proof.
6. Write proof note back to AGENT_BUS/HANDOFF-*.md and outbox ping.
7. Project ref previously noted: wbwgroygjeyukkspnqiy (verify before write).
```

---

## NEXT LLM PINBALL (READ THIS FIRST)

**You are in a pinball machine. Ball C is the only ball that scores money right now.**

1. Open `AGENT_BUS/PING_PONG_BALLS.json` — if revenue still 0, **do not** start new architecture.
2. If operator has not posted: **your only useful output** is to make posting friction zero (this handoff + DEMAND-KIT) and escalate human distribution.
3. If a live `cs_` session exists: run POST-SALE-PROTOCOL same day; advance loop instance PAY→SETTLE→FULFIL→PROOF; update balls only with evidence.
4. If Stripe plinks mismatch: fix SETTLEMENT-LINK-ALIGNMENT before claiming a sale on the meter.
5. Candidate loops above are **not** a license to ship 9 new SKUs. One fossil first.
6. Write your own `HANDOFF-YYYY-MM-DD-*.md` + outbox ping when state changes. Bump balls version.
7. Public posts: customer English only. No agent bus, fossils, gauntlet language in marketing.

**Forbidden score:** inventing revenue, discounting below floors, main merges without human, spending without approval.

---

## BRANCH ARTIFACTS THIS SESSION

- This handoff
- `AGENT_BUS/BRIDGE/outbox/ping-2026-09-26-pay-probability.json`
- `AGENT_BUS/ECONOMIC-LOOPS/candidates-2026-09-26.json`
- Updated `AGENT_BUS/PING_PONG_BALLS.json` (on this branch)
- Tightened `ops/money/distribution_queue.json` (extra jobs + urgency)

Merge path: human merges `agent/bridge-health-monetize-2026-09-26` when ready.
