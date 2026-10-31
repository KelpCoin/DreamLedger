# BECK visual architecture to tested cloud contracts (private design review)

Status: **DRAFT / REVIEW ONLY**. Source: owner's uploaded architecture drawings, November 2026.
The drawings are design intentions, **not runtime evidence**. This document records principles only.
No uploaded images, photos, private contacts, third-party copyrighted art, secrets or PII are copied into the repository.

## 1. Decision: one substrate, many silo experiments

Use the existing CUBE / 777 compiler, Elohim, Gauntlet, Truth Oracle, GitHub Actions,
Supabase, Stripe and the MTG master reference implementation. Do not build a
second scheduler, payments system, data lake, marketplace factory or control plane.
A research EXPEDITION is not a product, tenant, offer, customer or economic event.

The repository already contains `BEC-PRIME/runtime/RevenueBandit.js` with
`ucb1`, `choose`, `update`, and `prune`. The new
`BEC-PRIME/runtime/RevenueBanditEvidence.js` wraps the same selection
primitive with event and silo validation; it does NOT route live traffic.

The offline `ops/cube/multisilo_777_portfolio.py` uses nine research families,
seven lenses, seven transformations and seven gates to produce exactly 777
deterministic, balanced, private shadow candidates. It does not identify 777 buyers.

## 2. Mapping the supplied drawings to authoritative contracts

| Owner drawing theme | Existing implementation evidence | Missing proof or action | Authority |
|---|---|---|---|
| UCB1 / bandit traffic routing | RevenueBandit.js; shadow evidence adapter | exposure quality, lagged attribution, calibrated objective, live routing test | shadow analysis only |
| Mutate/prune/clone winners | CUBE_EXPERIMENT_POLICY.json and 777 generator | actual repeated positive-margin customer outcomes and rights | never auto clone/prune |
| Zero-human quote comparison | quote-intake, quote-fulfillment, worker contracts | complete uploaded-quote-to-buyer-delivery receipt and refund path | hold where records conflict |
| Truth Oracle hashes / evidence | existing policy, evidence ledgers, truth oracle workflows | independent verification, no false claims about immutability | append-only proof is not itself independent payment proof |
| Permanent QR and CTA carousel | canonical DreamLedger routing designs | actual conversion, consent and approved channel exposures | owner-gated publication |
| x402 agent API tolls | X402FactoryFactory.js is SPEC_READY_NOT_LIVE | network, asset, wallet, facilitator, anti-replay and real confirmed settlement | private protocol tests only |
| High-value B2B audit products | existing offers, Stripe, Airtable inventory | real buyer, delivered artifact, cost and margin | do not create duplicate SKUs |
| MTG free entry and community | MTG master silo and diagnostic design | working digital checkout and fulfillment reconciliation | preserve silo isolation |
| KelpHaven / DreamMeez avatar economy | original hand-drawn art protocol, shadow cosmetics | source drawing, artist approval, fit, entitlements, ledger | never publish without owner approvals |
| Cloud autonomous execution | GitHub Actions and Supabase Edge Functions | unresolved 503 and multiple failed CI jobs | reuse, no new paid infrastructure |
| Local GPU and LM Studio | self-hosted GitHub runner `economic-gpu-opportunistic.yml` | independent proof runner is online when PC off | GPU optional; never block cloud |
| Mutual-spec enforcement mesh | Gauntlet policies + CI checks | test that every handoff rejects bad input, replay and wrong silo | no self-certification |
| 0-to-1 economic event protocol | existing evidence ladder and settlement contracts | attributable independent paid and fulfilled transaction | scoreboard changes only with full proof |

## 3. Model boundaries and economic arithmetic

UCB1 is only meaningful when the reward is bounded consistently. Revenue per
visitor in NZD cannot be added to a dimensionless exploration term without
normalizing. `RevenueBanditEvidence.js` maps reported net contribution per
validated exposure into a bounded [0, 1] **heuristic**, while keeping the
underlying reported NZD minor-unit contribution separate. It is not a
causal revenue estimate or validated experimental policy.

Never include clicks, impressions, checkout starts, open sessions, internal
purchases, simulated outcomes or unreconciled PaymentIntents in the economic
reward. Missingness is UNKNOWN, not ZERO. Do not confuse an open Checkout
Session with a settled sale.

Do not prune below NZ$25 or clone above NZ$120 merely because these thresholds
appear in a drawing. Those thresholds lack sample size, uncertainty bounds,
time period, denominator and cost-adjustment context. No eligible clone/prune
or tenant-spawn authority exists in the shadow adapter.

Cost and margin must include actual incremental platform fees, compute,
support minutes, refunds, taxes where applicable, and delivery cost. When
unknown, use UNKNOWN and block margin claims, not zero.

## 4. Do not turn architectural claims into financial promises

- "100% zero human" is only a target until an end-to-end real buyer
  delivery flow is proven. Manual review must not be hidden.
- "Instant settlement" is not a universal truth; Stripe/webhook and x402
  facilitators have different acknowledgment/finality semantics.
- The x402 discovery spec has placeholder network, asset, destination and
  facilitator fields. No x402 sale is established by a manifest.
- "Escrow" requires a deliberately supported payment flow and legal review,
  not a generic name for a transaction ledger.
- "Free" and "zero commission" do not imply zero provider fees or
  hosting/compute expenses.
- External buyer requests are buyer **signals**, not authorization to spam.
- Programmatic tenant creation remains BLOCKED; no free production tenants
  or automatic billing from unverified winners.
- A paid AI-enhanced avatar cosmetic requires original source art,
  rights records, artist approval, fit/quality tests, real entitlement
  reconciliation and individual publication approval.
- Never mix adult creator assets or private customer materials into MTG,
  avatar, general DreamLedger, public reports or market-research exports.

## 5. Golden Event / Gold Mode admission test

For each offer, including digital and physical products, independently prove:

1. Valid product/silo identity, permission and legal rights.
2. Explicit major/minor price units and provider price match.
3. Approved public surface or legitimate buyer-initiated entry.
4. Valid intake and customer-supplied input capture.
5. Independently verified buyer (not self or synthetic).
6. Settled real payment attributed to the exact SKU and buyer.
7. Signature-validated webhook with replay-safe idempotency.
8. Validated worker output and proper rollback/retry status.
9. Actual delivery receipt with source and output hashes.
10. Customer delivery/acceptance evidence.
11. Proven direct costs, fees, refunds and operator effort.
12. Independent reconciliation of all claims and an audited proof reference.

If any gate is unknown, Gold Mode stays HOLD and there is no
automatic price mutation, tenant spawn, scale decision or verified revenue claim.

## 6. Safe launch sequence for the portfolio

1. Keep nine research silos and the existing 777 scheduled discovery available.
2. Repair cloud reliability and SKU/fulfillment contradictions.
3. Run shadow opportunity, price, variant and channel ranking without sending
   traffic or creating payment links.
4. Prove one complete economic loop in any silo, with actual customer consent.
5. Continue simultaneous research; reallocate **attention**, not money or
   live traffic, to the most promising evidence-backed work.
6. After repeat independent profitable outcomes, request explicit human
   authorization for small changes to traffic allocation and pricing.
7. Only then consider automated white-label tenant templates using existing CUBE,
   with explicit owner authorization, provisioning cost ceilings,
   security and rollback checks.

## 7. Verifier and rollback

```sh
python3 -m unittest discover -s ops/cube -p test_multisilo_777_portfolio.py -v
node --test BEC-PRIME/runtime/RevenueBanditEvidence.test.js
python3 ops/cube/multisilo_777_portfolio.py --output /tmp/777-MULTISILO-PORTFOLIO.json
```

The PR is a proposal on an isolated branch; closing it without merging is
the rollback. No production deploy, Stripe mutation, external outreach or public
release is authorized here.
