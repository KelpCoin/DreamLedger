# DreamLedger Hands-Off Economic Catalyst — Bottleneck Audit

Date: 2026-10-03 (updated same day after re-measure)  
Mode: REPAIR / CONNECT / EXPOSE / VERIFY  
Scoreboard (unchanged): VERIFIED_EXTERNAL_REVENUE = NZ$0.00

## Corrected live observations

| Surface | Result |
|---------|--------|
| GET /api/toll/v1/manifest | 200 ARMED |
| GET /api/toll/v1/checkout/gauntlet | **303 → live Stripe Checkout** (cs_live_*) |
| GET /api/toll/v1/checkout/truth | **303 → live Stripe Checkout** |
| GET /api/toll/v1/redeem/{scope}?session_id= | works (400 without session; issues key after paid) |
| POST /api/toll/v1/gauntlet | 401 invalid_toll_key (wall live) |
| POST /api/toll/v1/truth | 401 invalid_toll_key (wall live) |
| POST checkout/redeem | was 404 (method not handled); **fixed in commit 5c2b3a8** |
| /toll-road UI | Buy links = GET checkout; success page auto-redeems key |
| Stripe Payment Links | CMD-DIAG-29, QUOTE-COMPARE-49 VERIFIED_AVAILABLE |
| DB SQL | UNOBSERVABLE (control plane healthy; transport ECONNREFUSED) |

## Prior false diagnosis

Earlier probes used **POST** against checkout/redeem. The live UI and route table only implemented **GET**. That produced plain 404 fall-through and was incorrectly reported as "buy path dead."

## Repair applied

Commit `5c2b3a816fb163ddc8dc73bb56581d0a0388d932`:
- POST `/api/toll/v1/checkout/{scope}` → JSON `{url, session_id}`
- POST `/api/toll/v1/redeem/{scope}` with `session_id` in body or query
- GET behaviour unchanged (303 redirect / query redeem)

## Hands-off product path (now mechanically complete on the edge)

```
BUY (GET or POST checkout)
  → Stripe settled payment
  → REDEEM (session_id)
  → signed dlk_ key
  → POST /api/toll/v1/gauntlet or /truth with x-dreamledger-toll-key
  → automated result
```

No key without `payment_status=paid` + scope match + amount match.

## Remaining frontiers

1. **One independent buyer** pays NZ$19 or NZ$9 (or CMD-DIAG / Quote Compare Payment Links).
2. **DB observability** — authorized SQL path still blocked; cannot yet answer entitlement row binary questions from this sandbox.
3. **Deploy** — Render autoDeploy on commit; verify POST checkout after deploy lands.

## Do not

- Claim revenue from checkout session creation or 303 redirects.
- Invent DB credentials.
- Expand architecture.
