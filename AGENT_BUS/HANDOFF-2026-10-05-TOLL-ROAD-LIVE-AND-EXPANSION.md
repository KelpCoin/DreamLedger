# HANDOFF 2026-10-05 — Toll Road live + Agent Bridge monetisation expansion

**From:** Grok agent (bridge session)
**Mode:** hybrid
**Ball priority:** C (money / passive infrastructure revenue)
**Revenue claim:** NZ$0 (no external settlement observed this session)

## Live status (verified 2026-10-05)

- `GET https://dreamledger.org/api/toll/v1/manifest` → 200, status **ARMED** (pre-this-branch)
- Schema: dreamledger/toll-road/v2
- Model: customer pays → settled Stripe payment → entitlement → signed key (`x-dreamledger-toll-key`) → API wall → automated fulfilment
- Design target in runtime: **200 000** roads
- Existing catalogue: `AGENT_BUS/BRIDGE-TOLL-200.md` (200 paths)
- Next concrete batch: `AGENT_BUS/TOLL-ROADS-NEXT-BATCH.json` (20 defined)
- Stripe already connected; no new account required

## Wired scopes on this branch (13 total)

| Scope | Price NZ$ | Calls | Endpoint |
|-------|-----------|-------|----------|
| gauntlet | 19 | 100000 | /api/toll/v1/gauntlet |
| truth | 9 | 100000 | /api/toll/v1/truth |
| bridge-events | 19 | 100 | /api/toll/v1/bridge-events |
| route-lease | 29 | 10000 | /api/toll/v1/route-lease |
| gauntlet-pack | 15 | 20 | /api/toll/v1/gauntlet-pack |
| micro-ingest | 5 | 500 | /api/toll/v1/micro-ingest |
| job-claim | 9 | 200 | /api/toll/v1/job-claim |
| heartbeat | 4 | 1000 | /api/toll/v1/heartbeat |
| route-exclusive | 99 | 50000 | /api/toll/v1/route-exclusive |
| route-shared | 9 | 5000 | /api/toll/v1/route-shared |
| gauntlet-rush | 5 | 5 | /api/toll/v1/gauntlet-rush |
| gauntlet-async | 8 | 20 | /api/toll/v1/gauntlet-async |
| note-write | 7 | 200 | /api/toll/v1/note-write |

All share the same checkout → redeem → key flow. Thin meters only authorize the key and return a bounded automated result. No new payment rail.

## Immediate next steps after merge + deploy

1. Confirm `GET /api/toll/v1/manifest` lists all 13 services.
2. Smoke-test one new checkout URL (do not claim revenue).
3. Pull the next 10 items from `TOLL-ROADS-NEXT-BATCH.json` into SCOPES + thin handlers.
4. Keep public copy customer-English only.
5. Update `PING_PONG_BALLS.json` only when verified_external_revenue_nzd changes from real settlement.

## Do not

- Claim revenue from green CI or internal keys.
- Create parallel payment rails.
- Publish roads that require new architecture before 20 verified paid events (NS6).

North Stars remain in force.
