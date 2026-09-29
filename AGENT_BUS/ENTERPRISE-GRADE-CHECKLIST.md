# Enterprise-grade checklist — DreamLedger

**Updated:** 2026-09-30

## P0 — Site must answer (currently FAILING)

| Check | Status |
|-------|--------|
| https://dreamledger.org returns 200 | **FAIL — Service Suspended 503** |
| `/buy/...` checkouts reachable | blocked by host |

**Action:** Restore hosting first. No UI work fixes 503.

## P1 — Trust & legal

- [ ] **Fees** page live (`/fees.html`) — 0% success + slot prices
- [ ] Terms + Privacy (NZ plain language)
- [ ] Support email on money pages
- [ ] NZD only · no unverifiable claims

## P2 — Money path

- [ ] Primary CTA → live Stripe `/buy/{id}`
- [ ] Success/cancel clean · 24h SLA stated
- [ ] Sticky mobile CTA ≥52px

## P3 — Product UX

- [ ] Phone-first rails · B2B page clear · hide unpublished

## P4 — Security & ops

- [ ] Security headers · secrets in env · deploy from main · uptime alerts

## P5 — B2B

- [ ] Phase A kits + verify · Stripe slots when demand exists

## Enterprise-enough now

1. Site up  2. Pay works  3. Fees clear  4. Support reachable  5. Intentional on phone
