# DreamLedger Hands-Off Economic Catalyst — Bottleneck Audit

Date: 2026-10-03  
Mode: REPAIR / CONNECT / EXPOSE / VERIFY  
Scoreboard (unchanged): VERIFIED_EXTERNAL_REVENUE = NZ$0.00

## Live observations

| Surface | Result |
|---------|--------|
| dreamledger.org homepage | New enterprise copy live; commit 024f41d7 on Render |
| GET /healthz | 200 — catalog_loaded, cmd_diag_published, cmd_diag_price |
| GET /api/toll/v1/manifest | 200 ARMED — claims checkout_configured=true for Gauntlet NZ$19, Truth NZ$9, Road pack |
| POST /api/toll/v1/gauntlet | **401 invalid_toll_key** — wall is live |
| POST /api/toll/v1/truth | **401 invalid_toll_key** — wall is live |
| POST /api/toll/v1/checkout/* | **404 Not Found** — cannot buy a key |
| POST /api/toll/v1/redeem | **404 Not Found** |
| GET /toll-road | 200 — UI advertises Decision Check NZ$19 / Evidence Check NZ$9 Buy access |
| GET /go | 404 DOORWAY_FAILED |
| Stripe Payment Links | CMD-DIAG-29 and QUOTE-COMPARE-49 VERIFIED_AVAILABLE with buy.stripe.com URLs |
| stripe-revenue Edge Function GET | healthy; configured=false; stripe_api_key=false; webhook_secret=true |
| agent-toll-road /healthz | payment_mode=DISABLED_UNCONFIGURED; quote_compare_mode=DISABLED |
| PR #439 | Stripe webhook independent of optional API key — open, unstable CI, production hotfix claimed v25 |
| PR #438 | Agent Bridge monetization — open, empty CI status, base drifted from main |

## First measured blocker

```
BLOCKED_AT = CONFIGURATION / COMMERCE
BECAUSE    = Toll wall authenticates (401 without key) but checkout and redeem routes return 404.
             Manifest and /toll-road UI advertise buyable services; the buy path is not wired on the live storefront/engine route table.
REQUIRED   = Smallest repair: expose POST /api/toll/v1/checkout/{scope} and redeem against existing TollRoad v2 + Stripe Payment Link or Checkout Session creation already present in substrate (or wire UI to existing buy.stripe.com links for Decision/Evidence packs).
FALLBACK   = Use existing live Stripe Payment Links (CMD-DIAG-29, QUOTE-COMPARE-49) for first external payment while toll checkout is repaired — still requires settlement→entitlement→fulfillment observation.
OWNER_ACTION = None for inspection. Optional: confirm Stripe Dashboard webhook endpoint points at current stripe-revenue function and that STRIPE_API_KEY is intentionally absent vs missing secret.
HUMAN_MINUTES = 0 for this audit; ~15–30 if owner confirms Stripe secrets once.
EXPECTED_ECONOMIC_EFFECT = Unblocks "Buy key → wall admits → capability runs" for Decision Check / Evidence Check without human delivery.
```

## Closest path to money (ranked)

1. **Repair toll checkout routes** (measured 404) so NZ$19 / NZ$9 key purchase works against already-armed wall.
2. **Existing Stripe Payment Links** for Commander Diagnostic NZ$29 / Quote Compare NZ$49 — links live; settlement/fulfillment path must be observed after a real buyer pays.
3. **x402 agent-toll-road** — blocked at SECRETS (X402_PAY_TO / facilitator unconfigured).

## Do not

- Merge PR #438 blindly (base drifted; CI empty).
- Invent Session Pooler credentials or new entitlement architecture.
- Claim revenue from link existence or 401 wall responses.
- Expand agent-name public copy.

## Next engineering step

Locate storefront/engine route registration for `/api/toll/v1/*` and add the missing checkout + redeem handlers using existing TollRoad.issueKey / issueEntitlementForRoad and existing Stripe checkout creation codepaths. Test: POST checkout → Stripe URL → (manual external pay later) → redeem → POST gauntlet with key → non-401 result.
